import { readFile, writeFile } from "fs/promises";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default class Logger {

    #flag;
    #path;
    #promise_chain = Promise.resolve();
    #date_regex;
    #date_cleanUp_regex;
    #auto_format;

    /**
     * Logger constructor
     * 
     * @param {string} file - the (relative) path to the log file.
     * @param {string} [flag='a'] - the flag for appending logs to the file, defaults to 'a'. Must be either 'a', 'ax', 'w' or 'wx'
     * @param {number} [maxAge=7776000] - the maximum age in seconds, defaults to 7776000 (90 days)
     * @param {string} [date_delimiter='/'] - the delimiter for the date, defaults to '/' (DD/MM/YYYY)
     * @param {string} [time_delimiter=':'] - the delimiter for the time, defaults to ':' (HH:MM:SS.MS)
     * @param {boolean} [auto_format=true] - Whether to automatically format logs with a preceeding timestamp.
     * If set to false, it can be specified to format the log manually in the `log()` function.
     */
    constructor(file, flag='a', max_age=7776000, date_delimiter="/", time_delimiter=":", auto_format=true) { // 7.776.000 seconds = 90 days
        if(!file) throw new Error("Syntaxerror: missing constructor parameter \nExpected at least 1 parameter for Logger class");
        if(flag !== "a" && flag !== "ax" && flag !== "w" && flag !== "wx") throw new Error("I/O Error: Logger flag must be 'a', 'ax', 'w' or 'wx'");
        this.#path = file;
        this.#flag = flag;
        this.log_max_age = max_age;

        this.#date_regex = new RegExp(`^\\[?\\d{1,2}${date_delimiter}\\d{1,2}${date_delimiter}\\d{4}\\s?(?:\\d{1,2}${time_delimiter}\\d{1,2}${time_delimiter}\\d{1,2}\.\\d{1,3})?`);
        this.#date_cleanUp_regex = new RegExp(`^\\[?(\\d{1,2})\\${date_delimiter}(\\d{1,2})\\${date_delimiter}(\\d{4})\\s?(?:(\\d{1,2})${time_delimiter}(\\d{1,2})${time_delimiter}(\\d{1,2}).(\\d{1,3}))?`);
        this.#auto_format = auto_format;
    }

    #format(message, dateObj) {
        let [year, month, day, hours, minutes, seconds, milliseconds] = 
        [dateObj.getFullYear(), dateObj.getMonth() + 1, dateObj.getDate(), dateObj.getHours(), dateObj.getMinutes(), dateObj.getSeconds(), dateObj.getMilliseconds()];

        if(seconds < 10) seconds = "0" + seconds;
        if(minutes < 10) minutes = "0" + minutes;
        if(hours < 10) hours = "0" + hours;
        if(day < 10) day = "0" + day;
        if(month < 10) month = "0" + month;

        return `\n[${day}/${month}/${year} ${hours}:${minutes}:${seconds}.${milliseconds}] - ${message}\n`;
    }

    async #handler(event, event_param) {
        let logs;
        let filtered_logs;

        switch(event) {

            case "log":
                await writeFile(this.#path, event_param, {flag: this.#flag})
                .catch( err => {throw new Error("Error in log1: " + err)});
                break;

            case "get_logs":
                logs = await this.#getLogData();
                // if no filter resolve all logs
                if( !event_param.content && !event_param.date) {
                    if(event_param.cb)
                        event_param.cb(logs);
                    return logs;
                }
                
                // filter logs
                filtered_logs = logs.filter( log => {
                    if(!log) return false;
                    if(!event_param || !event_param.content && !event_param.date) return true;

                    if(event_param.content && log.includes(event_param.content)) return true;
                    if(event_param.date && log.includes(event_param.date)) return true;

                    return false;
                });

                // resolve filtered logs
                if(event_param.cb)
                    event_param.cb(filtered_logs);
                return filtered_logs;

            // clean up means deleting all logs older than logger.maxAge seconds
            case "clean_up":
                logs = await this.#getLogData();
                filtered_logs = logs.filter( log => {
                    if(!log) return false;

                    let ma = log.match(this.#date_cleanUp_regex);
                    if(!ma) return false;
                    
                    let date = new Date(ma[3], ma[2] - 1, ma[1], ma[4] ||0, ma[5] ||0, ma[6] ||0, ma[7] ||0);
                    let age = Date.now() - date.getTime();
                    if(age > this.log_max_age*1000) return false;
                    return true;
                });

                filtered_logs = filtered_logs.flatMap( x => ["", x]);
                filtered_logs.push("");

                await writeFile(this.#path, filtered_logs.join("\n"), {flag: "w"})
                .catch( err => {throw new Error(err)});
                break;
        }
        return;
    }

    /**
     * Log text to the log file. 
     *
     * @param {string} text - The text to be logged.
     * @param {boolean} [format=false] - If auto_format is false, indicates whether the text should be formatted or not.
     */
    log(text, format=false) {
        let log = text;
        if(this.#auto_format || format)
            log = this.#format(text, new Date());
        this.#promise_chain = this.#promise_chain.then( () => this.#handler("log", log).catch(err => err) );
    }
    
    /**
     * Retrieves logs from the file passed to the Logger object. If no date or content filter is specified, all logs are retrieved.
     * ***
     * If no callback function is specified, getLogs works as a **promise**:
     * ```
     * let logs = await logger.getLogs().catch( err => {...} );
     * logger.getLogs().then( logs => {...} ).catch( err => {...} );
     * ```
     * 
     * or else it works with a **callback**:
     * ```
     * logger.getLogs( (logs, error) => {if(error) throw error; ...} );
     * ```
     * ***
     * getlogs **can** be used both with a callback and as a promise, but that will result in **two responses**:
     * ```
     * logger.log("If you keep my secret, this strawberry is yours")
     * console.log("outer:", await logger.getLogs( (err, logs) => {
     *  if(err) throw err;
     *  console.log("inner:", logs)
     * }));
     * // output
     * // inner: ['If you keep my secret, this strawberry is yours']
     * // outer: ['If you keep my secret, this strawberry is yours']
     * ```
     * 
     * @param {function} cb - The callback function to be called with the retrieved logs. Returns error and logs.
     * @param {string} [date=null] - The date in the format "DD/MM/YYYY HH:MM:SS" to filter the logs by. If time is omitted, the logs will be
     * filtered only by the date.
     * @param {string} [content=null] - The content to filter the logs by.
     * @return {Promise} A promise that resolves with the retrieved logs or rejects with an error if the date is invalid.
     */
    async getLogs(cb, date = null, content = null) {
        if(date && !this.#date_regex.test(date)) {
            console.error("Invalid date: " + date + ". Must be in the format DD/MM/YYYY HH:MM:SS");
            if(cb) {
                cb(null, "Invalid date: " + date + ". Must be in the format DD/MM/YYYY HH:MM:SS");
            }
            return Promise.reject("Invalid date: " + date + ". Must be in the format DD/MM/YYYY HH:MM:SS");
        }

        return this.#promise_chain = this.#promise_chain.then( () => this.#handler("get_logs", {cb: cb, date: date, content: content}).catch(err => err) );
    }

    /**
     * Deletes all logs in the specified file older than max_age
     *
     */
    cleanUp() {
        this.#promise_chain = this.#promise_chain.then( () => this.#handler("clean_up", null).catch( err => err) );
    }

    async #getLogData() {
        let data = await readFile(this.#path, {encoding: "utf8"}).catch( err => err);
        return data.split("\n").flatMap(x => x ? [x] : []);
    }

}

const l = new Logger("test.log");

async function test() {
    l.log("test1");

    l.log("test2");
    
    l.log("test3");
    
    l.log("test4");
    
    l.log("test5");

    l.log("test6");

    l.getLogs( logs => console.log(logs) );

    console.log("waiting for 10 secs");
    await new Promise( resolve => setTimeout( () => resolve(), 10000) );
    console.log("waited for 10 secs");

    l.cleanUp();

    l.getLogs( logs => console.log(logs) );
    
    l.log("test7");
    console.time("time")

    console.log("no here",  await l.getLogs( logs => console.log("here", logs) ));

    console.log("waiting for 5 secs");
    await new Promise( resolve => setTimeout( () => resolve(), 5000) );
    console.log("waited for 5 secs");

    l.log("test8");

    l.log("test9");

    console.log( await l.getLogs());

    console.timeEnd("time");
    l.cleanUp();

    console.log( await l.getLogs());
    console.log( await l.getLogs());

    console.log("test");
};