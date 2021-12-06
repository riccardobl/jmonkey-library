
import Fs from 'fs/promises';
import Database from './Database.js';
import Api from '../common/Api.js';
import { v4 as uuid } from 'uuid';
import Path from 'path';

import Webp from 'webp-converter';
import Express from 'express';
import WebPMux from 'node-webpmux';
import Tmp from 'tmp';
import KeysManager from './KeysManager.js';
import EntriesManager from './EntriesManager.js';
import Ffmpeg from 'ffmpeg';
import Sharp from 'sharp';
export default class MediaManager {
    static async init(config, register, server) {
        this.upload_path = config.uploadPath;
        await Fs.mkdir(this.upload_path, { recursive: true });

        // Expose media files in /media
        server.use("/media", Express.static(this.upload_path));

        this.db = new Database("media.json");
        this.mediaDb = new Api(JSON.parse(await Fs.readFile("./common/messages/media/media-db.json")));
        this.mediaGet = new Api(JSON.parse(await Fs.readFile("./common/messages/media/media-get.json")));
        this.mediaUpload = new Api(JSON.parse(await Fs.readFile("./common/messages/media/media-upload.json")));
        this.mediaDelete = new Api(JSON.parse(await Fs.readFile("./common/messages/media/media-delete.json")));

        this.previewResolution = config.media.previewResolution;
        this.fullSizeResolution = config.media.fullSizeResolution;
        this.blurredCoverResolution = config.media.blurredCoverResolution;
        
        register("/media/set", this.mediaUpload, this.mediaUpload, (d, ip, checkReqPerms) => this.onUploadRequest(d, ip, checkReqPerms));
        register("/media/get", this.mediaGet, this.mediaGet, (d, ip, checkReqPerms) => this.onGetRequest(d, ip, checkReqPerms));
        register("/media/delete", this.mediaDelete, this.mediaDelete, (d, ip, checkReqPerms) => this.onDeleteRequest(d, ip, checkReqPerms));
    }


    // Set / Create new media
    static async set(userId, entryId, mediaId, data) {
        if (
            typeof mediaId == "undefined" ||
            mediaId >= this.mediaDb.getDefByType("database").media.maxArrayLength ||
            mediaId < 0
        ) throw new Error("Invalid index " + mediaId);

        if (!data) throw new Error("Invalid media data");


        // Get media array
        let media = (await this.db.get(userId, entryId))[0];
        if (!media) { // Create if not found
            media = await this.mediaDb.parse("database", {
                entryId: entryId,
                userId: userId,
                media: []
            });
            await this.db.set(userId, entryId, media);
            media = (await this.db.get(userId, entryId))[0];
        }

        // Extract info from b64 dataUrl
        const head = data.substring(0, data.indexOf(","));
        const mime = head.split(":")[1].split(";")[0].trim();
        const ext = mime.split("/")[1];
        data = data.substring(data.indexOf(",") + 1);
        data = Buffer.from(data, 'base64');


        // Update db and delete old file
        const setDb = async (newMedia) => {
            const oldMedia = media.media[mediaId];
            media.media[mediaId] = newMedia;
            await this.db.set(userId, entryId, media);
            if (oldMedia) {
                const oldMediaPath = Path.join(this.upload_path, oldMedia);
                try {
                    console.log("Remove old media", oldMediaPath);
                    await Fs.unlink(oldMediaPath);
                } catch (e) {
                    console.error(e);
                }
                const oldPreviewPath = oldMediaPath + ".preview.webp";
                try {
                    console.log("Remove old preview", oldPreviewPath);
                    await Fs.unlink(oldPreviewPath);
                } catch (e) {
                    console.error(e);
                }
            }
        }

        // Compute size
        const resize = (width, height, size) => {
            let resize;
            if (width > height) {
                const r = height / width;
                resize = [size, size * r];
            } else {
                const r = width / height;
                resize = [size * r, size];
            }
            return resize;
        }

        // Process video
        if (ext == "webm" || ext == "mp4") {
            const newMedia = (userId + "-" + entryId + "-" + mediaId).replace(/[^a-zA-Z0-9_\-]+/g, "_") + uuid() + ".webm";
            await setDb(newMedia);

            const newMediaPath = Path.join(this.upload_path, newMedia);
            const previewPath = newMediaPath + ".preview.webp";

            const tmpDir = Tmp.dirSync();
            const tmpFile = Path.join(tmpDir.name,"video."+ext);

            try {
                console.log("Write temp file", tmpFile);
                // Write uploaded data
                await Fs.writeFile(tmpFile, data);

                // Convert to webm video
                const ffmpeg = await new Ffmpeg(tmpFile);

                // const fullSize = resize(ffmpeg.metadata.video.resolution.w, ffmpeg.metadata.video.resolution.h, this.fullSizeResolution);

                ffmpeg.setVideoFrameRate(25);
                ffmpeg.setAudioBitRate(128);
                ffmpeg.setVideoFormat("webm");
                // ffmpeg.setVideoSize(`${fullSize[0]}x${fullSize[1]}`);
                console.log("Convert with ffmpeg", tmpFile, "to", newMediaPath);
                await ffmpeg.save(newMediaPath);

                // Export preview image
                // const previewSize = resize(fullSize[0], fullSize[1], this.previewResolution);
                const exportFramePaths = await ffmpeg.fnExtractFrameToJPG(tmpDir.name, { number: 1 });
                console.log("Save preview", exportFramePaths[1], "to", previewPath);

                await Sharp(exportFramePaths[1]).resize({
                    width:this.previewResolution[0],
                    height:this.previewResolution[1],
                    fit:"cover"
                }) .toFile(previewPath);


                const blurPath = newMediaPath + ".blur.webp";

                const blurredPartialSize=[Math.floor( this.blurredCoverResolution[0]*0.9),Math.floor(this.blurredCoverResolution[1]*0.9)];
                await Sharp(previewPath)

                .resize({
                    width:blurredPartialSize[0],
                    height:blurredPartialSize[1],
                    fit:"cover"
                }) 
                // .blur(10)
                .blur(20)
                .extend({
                    top: Math.floor((this.blurredCoverResolution[1]-blurredPartialSize[1])/2),
                    bottom: Math.floor((this.blurredCoverResolution[1]-blurredPartialSize[1])/2),
                    left: Math.floor((this.blurredCoverResolution[0]-blurredPartialSize[0])/2),
                    right: Math.floor((this.blurredCoverResolution[0]-blurredPartialSize[0])/2),
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                  })
                  .blur(60)
                  .toFile(blurPath);
            } catch (e) {
                console.error(e);
            } finally {
                // tmpFile.removeCallback();
                await Fs.rm(tmpDir.name, { recursive: true });
            }
        }
        // Compute image
        else if (ext == "gif" || ext == "webp" || ext == "png" || ext == "jpg" || ext == "jpeg") {
            const newMedia = (userId + "-" + entryId + "-" + mediaId).replace(/[^a-zA-Z0-9_\-]+/g, "_") + uuid() + ".webp";
            await setDb(newMedia);

            const newMediaPath = Path.join(this.upload_path, newMedia);
            const previewPath = newMediaPath + ".preview.webp";
            const blurPath = newMediaPath + ".blur.webp";

            const tmpFile = Tmp.fileSync();

            try {
                await Fs.writeFile(tmpFile.name, data);

                if (ext == "gif") {
                    console.log("Trying to convert as animated image");
                    await Webp.gwebp(tmpFile.name, newMediaPath, "-q 90 ");
                } else {
                    console.log("Trying to convert as static image");
                    await Webp.cwebp(tmpFile.name, newMediaPath, "-q 90  -low_memory");
                }

                const webpImg = new WebPMux.Image();
                await webpImg.load(newMediaPath);

                // const fullSize = resize(webpImg.width, webpImg.height, this.fullSizeResolution);

                // if (ext == "gif") {
                //     console.log("Trying to convert as animated image");
                    await Sharp(tmpFile.name).resize({
                        width:this.fullSizeResolution[0],
                        height:this.fullSizeResolution[1],
                        fit:"contain"
                    }) .toFile(newMediaPath);
                    // await Webp.gwebp(tmpFile.name, newMediaPath, "-q 90 " + fullSize[0] + " " + fullSize[1] + " ");
                // } else {
                //     console.log("Trying to convert as resized static image");
                //     await Webp.cwebp(tmpFile.name, newMediaPath, "-q 90 -resize " + fullSize[0] + " " + fullSize[1] + " -low_memory");
                // }

                // const previewSize = resize(webpImg.width, webpImg.height, this.previewResolution);

                if (webpImg.anim) {
                    console.log("Extract frame from animated webp for preview");
                    await webpImg._demuxFrame(tmpFile.name, webpImg.anim.frames[0]);
                    // await Webp.cwebp(tmpFile.name, previewPath, "-q 60 -resize " + previewSize[0] + " " + previewSize[1] + " 0 -low_memory");
                    await Sharp(tmpFile.name).resize({
                        width:this.previewResolution[0],
                        height:this.previewResolution[1],
                        fit:"cover"
                    }) .toFile(previewPath);

                } else {
                    console.log("Extract frame from static webp for preview");
                    await Sharp(tmpFile.name).resize({
                        width:this.previewResolution[0],
                        height:this.previewResolution[1],
                        fit:"cover"
                    }) .toFile(previewPath);
                    // await Webp.cwebp(newMediaPath, previewPath, "-q 60 -resize " + previewSize[0] + " " + previewSize[1] + " 0 -low_memory");
                }

                console.log("Create blurred preview");
                const blurredPartialSize=[Math.floor( this.blurredCoverResolution[0]*0.9),Math.floor(this.blurredCoverResolution[1]*0.9)];
                await Sharp(previewPath)

                .resize({
                    width:blurredPartialSize[0],
                    height:blurredPartialSize[1],
                    fit:"cover"
                }) 
                // .blur(10)
                .blur(20)
                .extend({
                    top: Math.floor((this.blurredCoverResolution[1]-blurredPartialSize[1])/2),
                    bottom: Math.floor((this.blurredCoverResolution[1]-blurredPartialSize[1])/2),
                    left: Math.floor((this.blurredCoverResolution[0]-blurredPartialSize[0])/2),
                    right: Math.floor((this.blurredCoverResolution[0]-blurredPartialSize[0])/2),
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                  })
                  .blur(60)
                  .toFile(blurPath);
                

            } catch (e) {
                console.error(e);
            } finally {
                tmpFile.removeCallback();
            }
        } else {
            throw "Unsupported format " + ext;
        }
        return {};
    }

    // Get a media
    static async get(userId, entryId, mediaId) {
        try {
            // Get media array
            let media = await this.db.get(userId, entryId);
            media = media[0];
            if (!media) throw new Error("Media not found " + userId + " " + entryId);

            // Get selected media
            media = media.media[mediaId];
            if (!media) throw new Error("Media not found " + userId + " " + entryId + " " + mediaId);
            // Compute paths
            const mediaPath = Path.join("/media", media);
            const previewPath = mediaPath + ".preview.webp";
            const blurPath = mediaPath + ".blur.webp";
            return { entryId: entryId, userId: userId, data: mediaPath, preview: previewPath,blurred:blurPath };
        } catch (e) {
            if (mediaId !== 0) throw e;
            // Compute paths
            const mediaPath = "/static/default.webp"
            const previewPath = mediaPath + ".preview.webp";
            const blurPath = mediaPath + ".blur.webp";
            return { entryId: entryId, userId: userId, data: mediaPath, preview: previewPath,blurred:blurPath };
        }
    }

    // Delete a media
    static async delete(userId, entryId, mediaId) {
        const media = (await this.db.get(userId, entryId))[0];
        if (!media) throw new Error("Media not found " + userId + " " + entryId);

        const mediaFile = media.media[mediaId];
        if (mediaFile) {
            const mediaPath = Path.join(this.upload_path, mediaFile);
            const previewPath = mediaPath + ".preview.webp";
            const blurPath = mediaPath + ".blur.webp";

            try {
                console.log("Remove", mediaPath);
                await Fs.unlink(mediaPath);
            } catch (e) {
                console.error(e);
            }
            
            try {
                console.log("Remove", previewPath);
                await Fs.unlink(previewPath);
            } catch (e) {
                console.error(e);
            }

            try {
                console.log("Remove", blurPath);
                await Fs.unlink(blurPath);
            } catch (e) {
                console.error(e);
            }
        }

        media.media[mediaId] = null; // remove media

        // media.media = media.media.filter(el => el); // compact array

        // Update db
        if (media.media.length == 0) {
            console.log("Media table empty. Unset");
            await this.db.unset(userId, entryId);
        } else {
            await this.db.set(userId, entryId, media);
        }
    }


    // Remove every media associated with an entry
    static async clear(userId, entryId) {
        const media = (await this.db.get(userId, entryId))[0];
        if (!media) return;
        for (let mediaId = 0; mediaId < media.media.length; mediaId++) {
            await this.delete(userId, entryId, mediaId);
        }
    }


    static async onUploadRequest(data, ip, checkReqPerms) {
        // check permissions
        const hints = [];
        const canEdit = await KeysManager.canEdit(data.modId, data.userId, data.authId, data.authKey, ip, hints);
        if (!canEdit) throw new Error("Unauthorized");
        checkReqPerms(hints);
        // if(data.modId && data.userId!=data.modId && !await KeysManager.validateAsMod(data.modId,data.authId,data.authKey,ip))throw new Error("Unauthorized");
        // else if(!await KeysManager.validate(data.userId,data.authId,data.authKey,ip)) throw new Error("Unauthorized");

        // Check associated entry
        if (!EntriesManager.get(data.userId, data.entryId)) throw new Error("Can't upload media for an entry that doesn't exist.");

        // Upload
        return this.set(data.userId, data.entryId, data.mediaId, data.data);
    }

    static async onDeleteRequest(dataIn, ip, checkReqPerms) {
        // Check permissions
        const hints = [];
        const canEdit = await KeysManager.canEdit(dataIn.modId, dataIn.userId, dataIn.authId, dataIn.authKey, ip, hints);
        if (!canEdit) throw new Error("Unauthorized");
        checkReqPerms(hints);

        // Get associated entry
        const entry = EntriesManager.get(dataIn.userId, dataIn.entryId);
        if (!entry) throw new Error("Can't delete media for an entry that doesn't exist.");


        // Delete media
        // if(data.modId && data.userId!=data.modId && !await KeysManager.validateAsMod(data.modId,data.authId,data.authKey,ip))throw new Error("Unauthorized");
        // else if(!await KeysManager.validate(data.userId,data.authId,data.authKey,ip)) throw new Error("Unauthorized");
        return this.delete(dataIn.userId, dataIn.entryId, dataIn.mediaId);
    }

    static async onGetRequest(dataIn, ip, checkReqPerms) {
        // Check permissions
        const hints = [];
        const canEdit = await KeysManager.canEdit(dataIn.modId, dataIn.userId, dataIn.authId, dataIn.authKey, ip, hints);
        checkReqPerms(hints);

        // Get associated entry
        const entry = EntriesManager.get(dataIn.userId, dataIn.entryId);
        if (!entry) throw new Error("Can't get media for an entry that doesn't exist.");

        // Get media
        const data = await this.get(dataIn.userId, dataIn.entryId, dataIn.mediaId);

        // Removed non required fields if the entry is banned and the user is not the owner or a mod
        if (data && !canEdit && (entry.suspended || entry.banned)) {
            const def = await this.entryApi.getDefByType("response");
            for (let k in data) {
                if (!def[k]["required"]) {
                    delete data[k];
                }
            }
        }

        return data;
    }


}

