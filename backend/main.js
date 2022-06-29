import Express from 'express';
import KeysManager from "./KeysManager.js";
import CookieParser from 'cookie-parser';
import EntriesManager from "./EntriesManager.js";
import PaymentManager from "./pay/PaymentManager.js";
import MediaManager from "./MediaManager.js";
import Utils from "../common/Utils.js";
import AutoImporter from "./importers/AutoImporter.js";
import Path from 'path';
import Abi from "../common/Abi.js";
import Fs from "fs/promises";
import Crypto from 'crypto';
import marked from 'marked';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import GithubOAUTH from "./authgateway/GithubOAUTH.js"
import Database from "./Database.js";
import DiscourseGateway from "./authgateway/DiscourseGateway.js";
import JmeInitializerIndex from './ext/JmeInitializerIndex.js';
import SplitDonations from "./ext/SplitDonation.js";
import ExpressCors from 'cors';
async function loadConfigs(onlyPublic){
    if(process.env.CONFIG_PATH){
        let config=await Fs.readFile(Path.join(process.env.CONFIG_PATH,"config.json"));
        config=JSON.parse(config);
        if(!onlyPublic){
            let backendConfig= await Fs.readFile(Path.join(process.env.CONFIG_PATH,"backend.json"));
            backendConfig=JSON.parse(backendConfig);    
            for(let k in backendConfig){
                config[k]=backendConfig[k];
            }
        }   
        return config;
    }else{
        let config=process.env.CONFIG;
        if(!config)throw "Please export CONFIG env variable";
        config=JSON.parse(config);
        if(!onlyPublic){
            let backendConfig=process.env.BACKEND_CONFIG;
            if(!config)throw "Please export BACKEND_CONFIG env variable";
            backendConfig=JSON.parse(backendConfig);

            for(let k in backendConfig){
                config[k]=backendConfig[k];
            }
        }   
        return config;
    }
}

const config=await loadConfigs();
const port = config.port;

await Database.setBasePath(config.databasePath);
const server = Express()


{
    const publicConfig=await loadConfigs(true);
    server.get("/config.json", async (req,res)=>{
        res.json(publicConfig);
        res.end();
    });
}



{
    server.set('json spaces', 2)
    server.use(ExpressCors());
    server.use(CookieParser());
    server.use(Express.json({limit:config.reqLimit}));
    server.use("/", Express.static("./frontend"));
    server.use("/common", Express.static("./common"));
    server.use(function (err, req, res, next) {
        console.error(err.stack)
        res.status(200).json({error:err.message});
    });
}


let apiEndPoints=undefined;
function register(path, apiReq, apiResp, callback) {
    console.info("Register api",path);
    const f = async (req, res) => {

        try {
            let data = req.body;
            let ip =  req.socket.remoteAddress;
            if(ip.startsWith("::ffff:"))ip=ip.substring("::ffff:".length);
            data = await apiReq.parse("request", data, false);

            data = await callback(data, ip,async (hints)=>{
                return apiReq.checkPermissions("request",data,hints)
            },
            async (hints)=>{
                return apiResp.checkPermissions("response",data,hints)
            });
            data = await apiResp.parse("response", data, false);
            res.json(data);
        } catch (e) {
            console.log("Error:", e,e.stack);
            res.json({ error: e+"" });
        }
        res.end();
    };
    server.post(path, f);
    server.get("/apidoc"+path+"/request", async (req,res)=>{
        res.json(await apiReq.getDefByType("request"));
        res.end();
    });
    server.get("/apidoc"+path+"/response", async(req,res)=>{
        res.json(await apiResp.getDefByType("response"));
        res.end();
    });
    if(!apiEndPoints){
        server.get("/apidoc", async(req,res)=>{
            res.json(apiEndPoints);
            res.end();
        });
        apiEndPoints=[];
    }
    apiEndPoints.push({
        method:"POST",
        path:path,
        requestDoc:"/apidoc"+path+"/request",
        responseDoc:"/apidoc"+path+"/response",
    });
}



{
    console.log("Init utils...");
    const window = new JSDOM('').window;
    const DOMPurify = createDOMPurify(window);
    await Utils.init(Crypto,marked,fetch,DOMPurify);
}

{
    console.info("Init keys manager...");
    await KeysManager.init(register);
}

{
    console.info("Init entires manager...");
    await EntriesManager.init(register);
}

{
    console.info("Init media manager...");
    await MediaManager.init(config,register,server);
}

if(config.discourse){
    console.info("Init Discourse auth gateway...");
    await DiscourseGateway.init(server,   config.discourse,register);
}

if(config.github){
    console.info("Init github OAUTH gateway...")
    await  GithubOAUTH.init(server,config.github);
}

{
    console.info("Init autoimporter...");
    await AutoImporter.initApi(register);
}

// const paymentGateway=new PaymentGateway();


    console.info("Init payment manager...");
    await PaymentManager.init(register,config.paymentChains)


try{
    JmeInitializerIndex.init(server,config);
}catch(e){
    console.error(e);
}


try{
    SplitDonations.init(server);
}catch(e){
    console.error(e);
}



{
    server.listen(port, () => console.log(`HTTP server listening on port ${port}`));
}