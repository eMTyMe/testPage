import express from 'express';
import bodyParser from 'body-parser';
import path, { dirname } from 'path'; 
import { fileURLToPath } from 'url';
import { config as dotenvConfig } from 'dotenv';
const __dirname = dirname(fileURLToPath(import.meta.url));
import MySQLStore from "express-mysql-session";
import session from 'express-session';
 
dotenvConfig();
 
const APP = express();
const PORT = 3100;
 
// Session store
const storeOptions = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_SCHEMA,
    createDatabaseTable: true,
    endConnectionOnClose: true,
    schema: {
        tableName: "testSessions",
        columnNames: {
            session_id: "session_id",
            expires: "expires",
            data: "data",
        },
    },
};
const MySQLStoreInstance = MySQLStore(session);
export const sessionStore = new MySQLStoreInstance(storeOptions);
APP.use(
    session({
        key: "session_cookie",
        secret: process.env.STORE_SECRET,
        store: sessionStore,
        resave: true,
        saveUninitialized: false,
        rolling: true,
        unset: "destroy",
        cookie: { maxAge: 3600000 } // 3600000 (1 hour) * n
    })
);

APP.set('view engine', 'ejs');
APP.set('views', path.join(__dirname, 'views'));
 
// bodyparser tranforms the response body into a json string - urlencoded makes sure that masked characters are translated properly
APP.use(bodyParser.json());
APP.use(express.urlencoded({ extended: true }));
APP.use(express.static(__dirname + '/public'));
 
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
 
APP.get('*', (req, res) => {
    req.session.user = { name: "John Doe" };
    return res.render("pages/default");
});
 
// starting server and listen to port ${PORT}
 
const server = APP.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
  
['SIGINT', 'SIGTERM'].forEach( event => {
    process.on(event, () => {
        console.log('Terminating signal received - closing server peacefully');
        server.close( error => {
            if(error) {
                console.error('Error while closing server: ' + error);
                process.exit(1);
            } 
            console.log('Server closed successfully');
        });
    });
});
