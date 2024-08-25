const { Pool } = require('pg');
const { param } = require('../routes/comment');
require("dotenv").config();

async function connect_postgresql() {
    const pool = new Pool({
        user: process.env.DB_REPO_USER,
        password: process.env.DB_REPO_PASS,
        host: process.env.DB_REPO_HOST,
        database: process.env.DB_REPO_DATABASE,
        port: process.env.DB_REPO_PORT
    });
    return pool;
}


/*
    userlog = {
        ipaddress: "",
        userId: "",
        username: "",
        userRole: "",
        channel: "",
        page: "",
        url: "",
        status: "",
        message: ""
    }

*/


const userLog = async (objlog) => {
    let json_res = {}
    console.log("==== user Log====")
    console.log(objlog);
    console.log(objlog.username);
    // console.log(objlog.userRole);
    let usrname = objlog.username;

    const pool = await connect_postgresql();
    try {
        if (!usrname) {
            console.log("no username")
            return {
                statusCode: 403,
                message: "Username not found"
            };
        }

        const sql = `
                INSERT INTO public.user_logs (ip_address, "user_name", "user_role", channel, page, "url", "action", status, message,  created_date)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, current_timestamp) RETURNING id
                `;

        console.log("sql")

        const params = [
            objlog.ipaddress, //"192.168.1.1",
            objlog.username,
            objlog.userRole,
            objlog.channel, //"website",
            objlog.page, //"home",
            objlog.url, //"http://localhost:3000/login",
            objlog.action,
            objlog.status,
            objlog.message
        ];

        console.log("[param] ", params)

        const resultLog = await pool.query(sql, params);
        // console.log(resultLog.rows[0]);
        // console.log(resultLog.rowCount);
        console.log("execute data")

        if (resultLog.rowCount > 0) {
            // return res.status(200).send({ message: "success", userId: userId });
            console.log("insert success")
            json_res = {
                statusCode: 200,
                message: "success",
                // userId: resultLog.row[0].id
            }

        } else {
            json_res = {
                statusCode: 500,
                message: "failed",
                // userId: null
            }
        }


    } catch (error) {
        console.log(error);
        json_res = {
            statusCode: 500,
            message: "Internal error",
            // userId: null
        }
    } finally {
        await pool.end();
    }

    return json_res;
};

module.exports = { userLog };