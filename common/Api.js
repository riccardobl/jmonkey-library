import Utils from "./Utils.js";

export default class Api {
    constructor(def) {
        this.def = def;
    }
    getDefByType(type) {
        for (let k in this.def) {
            if (this.def[k]["type"].indexOf(type) != -1) return JSON.parse(JSON.stringify(this.def[k]));
        }
        return null;
    }

    parseAndTypecheck(k, value, entryDef) {
        if (!entryDef) return;
        const entryType = entryDef["type"];
        if(!entryType)return undefined;

        if(value==null)value=undefined;
        if(typeof value==="undefined")return undefined;

        if (entryType === "string" && typeof value == "string") {
            if(value.trim()=="")return undefined;
            if (
                (typeof entryDef["minLength"] == "undefined" || value.length > entryDef["minLength"])
                &&
                (typeof entryDef["maxLength"] == "undefined" || value.length < entryDef["maxLength"])
            ) {
                if(typeof entryDef["sanitize"]!="undefined"){
                    value=Utils.sanitize(value,entryDef["sanitize"]);
                    Utils.checkString(value,entryDef["sanitize"]);

                    // try{
                    //     Utils.checkString(value,entryDef["sanitize"]);
                    // }catch(ee){
                    //     throw ee+" on "+k+"="+value;
                    // }
                }
                return value;
            } else {
                throw "Invalid length " + k;
            }
        } else if (entryType === "options" && typeof value == "string") {
            if (
                (typeof entryDef["minLength"] == "undefined" || value.length > entryDef["minLength"])
                &&
                (typeof entryDef["maxLength"] == "undefined" || value.length < entryDef["maxLength"])
            ) {
                for (let [k,v] of Object.entries(entryDef["options"])) {
                    if (k == value) {
                        return v;
                    }
                }
                throw "Invalid option " + k;
            }
            throw "Invalid length " + k;
        } else if (entryType === "number" && typeof value == "number") {
            if (
                (typeof entryDef["min"] == "undefined" || value >= entryDef["min"])
                &&
                (typeof entryDef["max"] == "undefined" || value <= entryDef["max"])
            ) {
                return value;
            }
            throw "Out of range: " + k;
        } else if (entryType === "boolean" && typeof value == "boolean") {
            return Boolean(value);
        } else if (entryType.endsWith("-array") && Array.isArray(value)) {
            if (typeof entryDef["minArrayLength"] != "undefined" && value.length < entryDef["minArrayLength"]) throw "Array is too short " + entryType;
            if (typeof entryDef["maxArrayLength"] != "undefined" && value.length > entryDef["maxArrayLength"]) throw "Array is too long " + entryType;
            for (let i in value) {
                const subDef = JSON.parse(JSON.stringify(entryDef));
                subDef["type"] = entryType.substring(0, entryType.indexOf("-array"));
                value[i] = this.parseAndTypecheck(k + "-" + i, value[i], subDef);
            }
            return value;

        }
        throw new Error(
            "Unknown type Expected: " + entryType + " but provided value is of type: " 
            + typeof value + " for key " + k //+ " = " + value +" ( "+  JSON.stringify(value) +" ) " +JSON.stringify(entryDef)
        );
    }

    
    async checkPermissions(type, values,permHints) {
        if (!permHints||permHints.length==0) return;

        let def = this.getDefByType(type);
        if (!def) throw "No def found for type " + type;
        if (permHints) {
            for (let k in values) {
                const entryDef=def[k];
                const entryPermHints = entryDef["permHints"];
                if (entryPermHints) {
                    if (!entryPermHints.find(e => permHints.includes(e)))
                        throw "Permission denied. Expected hints "
                        + JSON.stringify(entryPermHints) + " but user has " + JSON.stringify(permHints);
                }
            }
        }
    }
    async parse(type, values, withMeta) {
        const getValue=(value,def)=>{
            if (typeof value == "object" && value&&value["value"]) value = value["value"];
            if (typeof value=="undefined") value = def.value; // use default value if unset
            return value;
        };

        let def = this.getDefByType(type);
        if (!def) throw "No def found for type " + type;
        if (!values){
            throw "undefined values?";
        } 
        const out = {};

        // Shortcut for errors.
        if(values["error"]&&def["error"]){
            let error=values["error"];
            error=getValue(error,def["error"]);
            out["error"]=this.parseAndTypecheck("error", error, def["error"]);
            return out;
        }
        
        for (let k in def) {
            if(k=="?")continue; // skip documentation 
            let value = values[k];

            value=getValue(value,def[k]);
            
            if ( typeof value == "undefined") {
                if(def[k]["required"] )throw new Error("Missing required field " + k+" ");//+JSON.stringify(values));
                 else continue;
            }


            value = this.parseAndTypecheck(k, value, def[k]);
            
            if (def[k]["required"] && typeof value == "undefined") throw new Error("Missing required field " + k);//+" "+JSON.stringify(values));

            if(! (typeof value=="undefined")){
                if (withMeta) {
                    def[k]["value"] = value;
                    out[k] = def[k];
                } else {
                    out[k] = value;
                }
            }
        }

        return out;
    }
}

