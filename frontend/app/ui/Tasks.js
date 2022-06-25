import Ui from "./ui.js";
import Utils from "/common/Utils.js";


export default class Tasks {
    static init() {
        const r=() => {
            this.renderTasks();
            setTimeout(r,2000);
        }
        r();
        
    }
    static ok(id, text) {
        // Utils.enqueue(async () => {

            const waitingTasks = this.getTasks();

            let oldTask = waitingTasks[id];
            if (!oldTask && text) {
                waitingTasks[id] = oldTask = {
                    text: text
                };
            }
            if (oldTask) {
                console.log("Complete waiting task " + id);
                oldTask.done = true;
                this.setTasks(waitingTasks)
                this.renderTasks();
            }
        // });
    }

    static setTasks(tasks) {
        const temp = {};
        const persist = {};
        for (let k in tasks) {
            const task = tasks[k];
            if (task.persistent) persist[k] = task;
            else temp[k] = task;
        }
        this.temporaryTasks = temp;
        Utils.setLocalData("tasks", persist);

    }



    static getTasks() {
        let tasks = Utils.getLocalData("tasks") || {};
        const temp = this.temporaryTasks || {};
        for (let k in temp) {
            tasks[k] = temp[k];
        }
        return tasks;
    }


    static renderTasks() {
        const tasks = this.getTasks();
        

        let tasksListEl = document.querySelector("#tasks");
        if (!tasksListEl) {
            tasksListEl = document.createElement("ul");
            tasksListEl.setAttribute("id", "tasks");
            document.body.appendChild(tasksListEl);
        }

        // if (!tasks || Object.keys(tasks).length == 0) {
        //     setTimeout(() => {
        //         tasksListEl.classList.add("hidden");
        //         tasksListEl.innerHTML = "";
        //     }, 2000);
        //     return;
        // }
        // tasksListEl.classList.remove("hidden");
        let lock=false;

        for (let id in tasks) {
            const task = tasks[id];

            let taskEl = tasksListEl.querySelector("#task" + id);
            if (!taskEl) {
                taskEl = document.createElement("li");
                taskEl.setAttribute("id", "task" + id);
                tasksListEl.appendChild(taskEl);
            }

            if (task.done || task.error) {
                delete tasks[id];
                setTimeout(() => {
                    console.log("Completed", taskEl);
                    taskEl.remove();
                }, 4000);
            } else {
                if (task.timeout && task.timeout < Date.now()) {
                    task.done = true;
                }
            }

            if (task.done) {
                taskEl.classList.add("completedTask");
                taskEl.innerHTML = `<i class="fas fa-check-circle"></i>`;
            } else if (task.error) {
                taskEl.classList.add("completedTask");
                taskEl.innerHTML = `<i class="far fa-times-circle"></i>`;
            } else {
                taskEl.innerHTML = `<i class="fas fa-spinner fa-pulse"></i>`;
            }
            taskEl.innerHTML += ` ${task.text}`;
            const currentPage = location.href.split("!")[1] || "";

            if (!task.done && !task.error) {
                if (typeof task.lockPage == "string" && task.lockPage == currentPage) {
                    taskEl.classList.add("important");
                    lock=true;
                    // alert("Lock"+id)
                    
                } else {
                    // alert("UnLock"+id)

                    taskEl.classList.remove("important");
                }
            } else {
                taskEl.classList.remove("important");
                if (task.done && task.lockPage == currentPage && task.reload) {
                    Ui.reload();
                }
            }

        }

        if(!lock){
            // 
            if(document.body.classList.contains("locked")){
                document.body.classList.remove("locked");
                // alert("Unlock");
            }
        }else{
            if(!document.body.classList.contains("locked")){
                document.body.classList.add("locked");
                // alert("lock");

            }

        }

        this.setTasks(tasks);


    }

    static error(id, text) {
        // Utils.enqueue(async () => {
            const waitingTasks = this.getTasks();

            let oldTask = waitingTasks[id];
            if (!oldTask && text) {
                waitingTasks[id] = oldTask = {
                    text: text
                };
            }
            if (oldTask) {
                console.log("Complete waiting task " + id);
                oldTask.error = true;
                this.setTasks(waitingTasks)
                this.renderTasks();
            }
        // });
    }

    static completable(id, text, data, lock, persistent, timeout, reloadOnComplete) {
        // Utils.enqueue(async () => {

            const waitingTasks = this.getTasks();

            waitingTasks[id] = {
                text: text,
                timeout: timeout ? (Date.now() + timeout) : undefined,
                data: data,
                done: false,
                reload: typeof reloadOnComplete == "undefined" ? true : reloadOnComplete
            };
            console.log("Create waiting task " + id);
            if (lock) {
                waitingTasks[id].lockPage = location.href.split("!")[1] || "";
            }
            waitingTasks[id].persistent = persistent;
            this.setTasks(waitingTasks)
            this.renderTasks();
        // });
    }
}