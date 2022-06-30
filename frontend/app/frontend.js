import Api from "/common/Api.js";
import Auth from "./Auth.js";
import Entries from "./Entries.js";
import Media from "./Media.js";
import UiEntry from "./ui/UiEntry.js";
import UiListEntries from "./ui/UiListEntries.js";
import UiUser from "./ui/UiUser.js";
import Ui from "./ui/ui.js";
import Utils from "/common/Utils.js";
import Config from "./Config.js";
import Payment from "./Payment.js"
import Abi from "/common/Abi.js";
import Tasks from "./ui/Tasks.js";
import UrlParams from "./UrlParams.js";
import Msg from "./Msg.js";


// function processEntry(parent, entry, write) {

//   for (let k in entry) {
//     const v = entry[k];
//     // console.log(els);

//     const apply = (dom, k, v) => {
//       // console.log(v,dom.outerHTML);

//       const els = dom.querySelectorAll(`[msg-id="${k}"]`);
//       els.forEach(el => {

//         const sep = el.getAttribute("msg-sep");
//         const arrayItem = el.getAttribute("msg-array-item");
//         const isArray = Array.isArray(v);
//         if (isArray) {


//           if (!sep || !arrayItem) return false;
//           const joinedV = v.join(sep);
//           // console.log("Joinedv",joinedV);
//           v.forEach(vv => {
//             let tmpEl = document.createElement("div");

//             //
//             tmpEl.innerHTML = arrayItem;
//             apply(tmpEl, k + "-joined", joinedV);
//             apply(tmpEl, k, vv);

//             // console.log("Append", tmpEl.innerHTML,arrayItem);
//             el.innerHTML += tmpEl.innerHTML;
//           });
//           apply(el, k + "-joined", joinedV);

//         } else {
//           const dest = el.getAttribute("msg-out");

//           if (!dest) {
//             // console.log("Dest unset");
//             return false;
//           }

//           const getSet = (el, kk, v) => {

//             if (v) { // Set
//               kk.split(",").forEach(k => {
//                 if (k == "innerText") {
//                   if (el.innerText.indexOf("$v") != -1) {
//                     el.innerText = el.innerText.replaceAll("$v", v);
//                   } else {
//                     el.innerText = v;
//                   }
//                 } else {
//                   const oldV = el.getAttribute(k);
//                   if (oldV && oldV.indexOf("$v") != -1) {
//                     el.setAttribute(k, oldV.replaceAll("$v", v));
//                   } else {
//                     el.setAttribute(k, v);
//                   }
//                 }
//               });
//             } else {
//               const k = kk;
//               if (k == "innerText") {
//                 return el.innerText;
//               } else {
//                 return el.getAttribute(k);
//               }
//             }
//           }

//           // const origin = el.getAttribute("original-" + dest);
//           // let destV;
//           // if (origin) {
//           // destV = origin;
//           // getSet(el, dest, destV);
//           // } else {
//           // destV = getSet(el, dest);
//           // el.setAttribute("original-" + dest, destV)
//           // }

//           // console.log("TTTT",destV);
//           // let finalV = destV && destV.indexOf("$v") != -1 ?  destV.replace("$v", v) : v;

//           // console.log("Set", dest, v, "for", el.outerHTML);
//           getSet(el, dest, v);
//           // console.log( el.outerHTML);
//         }

//       });
//       return true;

//     }

//     // const dest=e.getAttribute("msg-out");
//     // if(!dest)continue;
//     apply(parent, k, v);




//   }

// }
// const toBase64 = file => new Promise((resolve, reject) => {
//   const reader = new FileReader();
//   reader.readAsDataURL(file);
//   reader.onload = () => resolve(reader.result);
//   reader.onerror = error => reject(error);
// });

// async function loadUploaders(dom) {
//   dom.querySelectorAll("editor.uploader").forEach(el => {
//     const media = el.querySelectorAll("media");
//     for (let itemId = 0; itemId < media.length; itemId++) {
//       const el2 = media[itemId];
//       console.log(el2);
//       const fileSelector = el2.querySelector("input[type=file]");
//       if (!fileSelector) return;
//       fileSelector.value = "";
//       fileSelector.addEventListener('change', async ev => {
//         let filename = ev.target.value.split("/");
//         filename = filename[filename.length - 1];
//         el2.querySelectorAll("preview > *").forEach(el3 => el3.style.display = "none");
//         el2.querySelectorAll("preview > video").forEach(el3 => el3.pause());
//         const b64enc = el.querySelector("b64enc");
//         let b64;
//         if (filename.endsWith(".jpg") || filename.endsWith(".webp") || filename.endsWith(".png")) {
//           const preview = el2.querySelector("preview img");
//           preview.src = URL.createObjectURL(ev.target.files[0]);
//           preview.style.display = "block";
//           b64 = await toBase64(ev.target.files[0])
//         } else if (filename.endsWith(".webm")) {
//           const source = document.createElement("source");
//           source.type = "video/" + filename.substring(filename.lastIndexOf(".") + 1);
//           source.src = URL.createObjectURL(ev.target.files[0]);
//           console.log(filename);
//           const preview = el2.querySelector("preview video");
//           preview.querySelectorAll("source").forEach(el3 => el3.remove());
//           preview.append(source);
//           preview.style.display = "block";
//           preview.load();
//           b64 = await toBase64(ev.target.files[0])
//         } else {
//           return;
//         }

//         if (b64enc && b64) {
//           const vs = b64enc.innerText.split(",");
//           vs[itemId] = b64;
//           b64enc.innerText = vs.join(",");
//         }
//       });
//     };
//   });
// }




// const getUrlParams = () => {
//   if (!window.location.hash) return {};

//   const out = {};
//   let parts = window.location.hash.split("!")[1];
//   parts = parts ? parts.split("&") : [];
//   parts.forEach(p => {
//     const [k, v] = p.split("=");
//     // sanitize k and v
//     out[k] = decodeURI(v ? v : "");
//   });
//   return out;

// }

window.addEventListener("load", async () => {
  // let initialized = false;
  let config;
  let parentEl;
  let mainMenu;


  // const init = async () => {
  // if (initialized) return;
  // initialized = true;
  config = await Config.get();
  // Msg.setApiVersion(config.apiVersion||"1.0");

  UrlParams.init();
  Utils.init(window.crypto, window.marked, window.fetch, window.DOMPurify);
  Ui.init();
  Tasks.init();

  parentEl = document.querySelector("main");
  parentEl.clear=async ()=>{
    return new Promise((resolve,reject)=>{
      // parentEl.classList.add("hide");
      
      // setTimeout(()=>{
        parentEl.innerHTML="";
      //   if(autoshow)    parentEl.classList.remove("hide");
        resolve();
      // },500);
    });
  };

  // parentEl.show=async ()=>{
    
  //   setTimeout(()=>{

  //   parentEl.classList.remove("hide");
  //   },200);
  // };

  mainMenu = document.querySelector("#mainMenu");

  document.body.querySelector("header").append(Ui.createMessage("", config.globalMessage));

  await Payment.init();

  Abi.init("", (root, path) => {
    if (!path) throw new Error("Path is undefined?");
    return fetch(root + path).then(res => res.json());
  });
  // }


  const load = async () => {
  
    Tasks.completable("loading", "Loading...",{});
    // await init();

    mainMenu.innerHTML = "";
    if (await Auth.isLoggedIn()) {
      // Ui.setClickAction(mainMenu.appendChild(Ui.createButton("fas fa-tree", "My Entries", "", undefined, [])), `#entries!user=${Auth.getCurrentUserID()}`, [], true, true)

      Ui.setClickAction(mainMenu.appendChild(Ui.createButton("fas fa-plus", "New Entry", "New Entry", undefined, [])), async () => {

    

        UiEntry.loadEntry(parentEl, {
          "entryId": Utils.uuidv4(),
          "userId": Auth.getCurrentUserID(),
          "authId": Auth.getCurrentKeyID(),
          "authKey": Auth.getCurrentKey(),
          "name": "New Entry",
          "description": "This is a new entry",
          "descriptionSummary": "This is a new entry",
          "version": "1.0",
          "funding":true,
          "tags": ["new"]
        }, [], true, true)

      });

      Ui.setClickAction(mainMenu.appendChild(Ui.createButton("fas fa-users-cog", "User", "Settings", undefined, [])), () => {
        UrlParams.replace({
          user: "current"
        });
      });

      Ui.setClickAction(mainMenu.appendChild(Ui.createButton("fas fa-door-open", "Logout", "LogOut", undefined, [])), async () => {
        Tasks.completable("log-out", "Logging out...", {}, true, false, 10000);
        await Auth.logout();
        Ui.reload();
      });

    } else {
      Ui.setClickAction(mainMenu.appendChild(Ui.createButton("fas fa-sign-in-alt", "Login", "LogIn", undefined, [])), async () => {
        Ui.showDialog("LogIn", `
        <span style="text-align:center;display:block;">
          <i class="bigIcon fas fa-user"></i>
          <br />
          You will be redirected to hub.jmonkeyengine.org for authentication.
        </span>
        `,
          [
            {
              text: `<i class="fas fa-times"></i> Cancel`
            },
            {
              text: `Continue <i class="fas fa-key"></i>`,
              action: async () => {
                Tasks.completable("log-in", "Logging in...", {}, true, false, 10000);
                await Auth.login();
              }
            }
          ]



        )
      });
    }


    if (UrlParams.get("entry")) {
      const [userId, entryId] = UrlParams.get("entry").split("/");
      await UiEntry.load(parentEl, userId, entryId, false);
    } else if (UrlParams.get("user")) {
      await UiUser.load(parentEl, config)
    } else {
      await UiListEntries.load(parentEl, UrlParams.get("s"));
    }
  };

  setTimeout(() => {
    load();
    UrlParams.addListener(() => load())
  }, 1);

  // window.addEventListener("hashchange", function () {
  //   load();
  // });
});
