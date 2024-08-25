const { Pool } = require('pg');
require("dotenv").config();
const bcrypt = require("bcryptjs");

async function connect_DB_API() {
    const pool = new Pool({
        user: process.env.DB_API_USER,
        password: process.env.DB_API_PASS,
        host: process.env.DB_API_HOST,
        database: process.env.DB_API_DATABASE,
        port: process.env.DB_API_PORT
    });
    return pool;
}

const validateUser = async (username, hashedPassword, role, menuName) => {

    console.log('validate user ')
    console.log(hashedPassword)
    const pool = await connect_DB_API();

    try {
        if (!username || !hashedPassword) {
            return {
                // data: {
                    statusCode: 400,
                    message: "Bad Request"
                // }
            }
        }


        const sql = `
                    SELECT
                        gu.id AS "groupUserId",
                        u.email AS "username",
                        u.password AS "password",
                        g.group_name AS "groupRole",
                        mu.id  AS "menuId",
                        mu.menu  AS "menuName"
                    FROM public.group_users gu
                    INNER JOIN public.users u ON u.id = gu.user_id and u.is_active = '1'
                    INNER JOIN public."group" g ON g.id = gu.group_id
                    INNER JOIN public.group_menu gm ON g.id = gm.group_id
                    INNER JOIN public.menu_url mu  ON mu.id = gm.menu_id --and mu.is_delete = '0'
                    WHERE u.email = $1
                    --AND mu.menu = $2
                `;
        const params = [username] //, menuName]

        console.log("get params");

        const user = await pool.query(sql, params);

        console.log("get result from validate user");
        console.log("[result]  ", user.rowCount)

        if (user && user.rowCount < 1) {
            return {
                "statusCode": "401",
                "message": "Unauthorized",
                "username": null
            }
        }

        const existUser = user.rows[0];
        console.log("[exts user] ", existUser.password);

        const passwordMatches = await bcrypt.compare(existUser.password, hashedPassword)

        // if(existUser.groupRole === role) {

        if (passwordMatches) {
            console.log("match")
            return {
                "statusCode": "200",
                "message": "success",
                "username": username,
                "role": existUser.groupRole
            }

        } else {
            console.log("not match")
            return {
                "statusCode": "401",
                "message": "Unauthorized",
                "username": null,
                "role": null
            }
        }

    } catch (error) {
        console.log("[Error check user], ", error);
        return json(
            {
                "statusCode": "500",
                "message": "Internal Server Error"
            });

    } finally {
        await pool.end()
    }
}

const getUserAll = async () => {
    let objResult = {};

    const pool = await connect_DB_API();

    try {
        const sql = `
                    SELECT id, name, username, "role" from users
                    WHERE is_active  = '1'
                `;

        const users = await pool.query(sql);

        let allusr = users.rows;
        objResult = {
            "statusCode": "200",
            "message": "Success",
            "data": allusr
        }


        // return json(
        //     {
        //        "statusCode": "201",
        //        "message": "Success"
        //    });

        // objResult = {
        //     "statusCode": "201",
        //     "message": "Success"
        // };

    } catch (error) {
        // return json(

        console.log("[Error ] ::", error);

        objResult = {
            "statusCode": "500",
            "message": "Internal Server Error"
        };

    } finally {
        await pool.end();
    }

    return objResult;
}

const userPermission = async (username, role, url) => {

    let jsonResult = {}
    const pool = await connect_DB_API();

    try {
        if (!username || !role) {
            return {
                statusCode: 400,
                message: "Bad Request"
            }
        }

        const sql = `
                    SELECT
                        gu.id AS "groupUserId",
                        u.email AS "username",
                        u.password AS "password",
                        g.group_name AS "groupRole",
                        mu.id  AS "menuId",
                        mu.menu  AS "menuName",
                        mu.url AS "url"
                    FROM public.group_users gu
                    INNER JOIN public.users u ON u.id = gu.user_id and u.is_active = '1'
                    INNER JOIN public."group" g ON g.id = gu.group_id
                    INNER JOIN public.group_menu gm ON g.id = gm.group_id
                    INNER JOIN public.menu_url mu  ON mu.id = gm.menu_id and mu.is_delete = '0'
                    WHERE u.email = $1
                    AND u.role = $2
                    AND mu.url = $3
                `;

        const params = [username, role, url];
        const user = await pool.query(sql, params);

        if (user && user.rowCount < 1) {
            jsonResult = {
                "statusCode": "401",
                "message": "Unauthorized",
                "username": null,
                "role": null
            };
        } else {
            jsonResult = {
                "statusCode": "200",
                "message": "Authorized",
                "username": username,
                "role": role
            };
        }
        return jsonResult;
    }
    catch (error) {
        console.log("[Error check user], ", error);
        return (
            {
                "statusCode": "500",
                "message": "Internal Server Error"
            });
    } finally {
        await pool.end();
    }

}

module.exports = { validateUser, getUserAll, userPermission }