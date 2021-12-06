import Utils from "/common/Utils.js";

export default class Msg {
    static async getDef(name) {
        return fetch("/common/messages/" + name + ".json").then(r => r.json());
    }



}