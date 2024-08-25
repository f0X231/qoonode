const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const { Pool } = require('pg');
const cors = require("cors");
require("dotenv").config();


const {
    jwtGenerateToken,
    jwtRefreshTokenGenerate,
    jwtRefreshToken,
    jwtValidate
} = require("./middleware/jwt_middleware");


const comment = require("./routes/comment");
const user = require("./routes/user");
const menu  = require("./routes/admin/menu");
const groups = require("./routes/admin/groups");

const { userLog } = require("./middleware/audit_log");
const { validateUser, getUserAll, userPermission } = require("./controller/user/index.js")


const PORT = process.env.PORT | 8124;

// app.use(bodyParser.urlencoded());
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())


//// core middleware
const corsOptions = {
    origin: 'http://localhost:3000',

    credentials: true,
};
app.use(cors(corsOptions));

// app.use(corsMiddleware);
app.use('/comment', comment);
app.use('/user', user);
app.use('/admin', menu);
app.use('/admin', groups);

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


////  #### Middleware ####
const logAuthen = async (username, channel, page, url, action, status, message) => {
    // const logAuthen = async (req, res, next) => {

    objlog = {
        ipaddress: "192.168.1.1",
        username: username, //req.body.username, // "admin",
        userRole: null,
        channel: channel,
        page: page, //"home",
        url: url,//"http://localhost:8080/login",
        action, //: action,
        status,//: status,
        message,//: message
    }

    let code = "";
    let msg = "";

    try {
        const result = await userLog(objlog);

        // console.log("[rs] ", result);

        if (result.statusCode != 200) {
            code = 403;
            msg = "Forbidden1111";
        } else {
            code = 200;
            msg = "success"
        }

    }
    catch (error) {
        console.log("error ", error);

        code = 500;
        msg = "Internal Error Log auth";
    }
    finally {

        // req.code = code
        // req.msg = msg
        // req.test = "1234";
        // next();
    }
}

const checkPermission = async (req, res, next) => {
    console.log("check permission")
    const { username, hashedPassword, group, menu } = req.body;

    try {
        const result = await validateUser(username, hashedPassword, group, menu);

        if (result.statusCode === "200") {
            console.log("result success")
            req.username = result.username;
            req.role = result.role;
            req.statusCode = result.statusCode;
            req.message = result.message;
        } else {
            console.log("result failed")
            // res.status(403).json({ message: "Forbidden" });
            // res.status(500).json({ message: "Internal Error Log auth" });
            req.statusCode = result.statusCode; // 401;
            req.message = result.message;// "";
        }

    } catch (error) {
        console.log("[error] ", error)
        req.statusCode = 500;
        req.message = error;
    }
    finally {
        next();
    }
}

// app.use(logAuthen);
// app.use(checkPermission);


//// #### Route API ####
app.get("/api/home", jwtValidate, async (req, res) => {
    res.json({
        statuscode: 200,
        message: "Hello World!",
        result: req.body
    });
});



app.post("/api/verify", jwtValidate, async (req, res) => {
    console.log('req.user', req.user.name,);
    const { url } = req.body; 
    const pool = await connect_DB_API();
    console.log('url', url);
    const query = `
        SELECT
            gu.id AS "groupUserId",
            u.email AS "username",
            u.password AS "password",
            g.group_name AS "groupRole",
            mu.id  AS "menuId",
            mu.menu  AS "menuName",
            mu.url AS "url"
        FROM public.group_users gu
        INNER JOIN public.users u ON u.id = gu.user_id
        INNER JOIN public."group" g ON g.id = gu.group_id
        INNER JOIN public.group_menu gm ON g.id = gm.group_id
        INNER JOIN public.menu_url mu ON mu.id = gm.menu_id 
        WHERE u.email = $1
        AND mu.url LIKE CONCAT('%', $2::text, '%');
    `;
    
    const params = [req.user.name, url]; 
    
    try {
        const result = await pool.query(query, params); 
        if (result.rows.length === 0) {
            res.status(403).json({ error: 'Forbidden' });
        } else {
            res.json(result.rows); 
        }
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        await pool.end(); 
    }
});




app.post("/api/login", checkPermission, async (req, res) => {

    // console.log("login111222 ", req.body);
    // console.log("===================================")
    // console.log("statusCode::", req.statusCode)
    // console.log("msg::", req.message)

    const username = req.body.username;
    const role = req.role;
    let page = "login"
    let url = 'http://localhost:3000/login'
    let action = 'login'
    let status = ''
    let messageLog = "";

    try {

        if (req.statusCode != 200) {
            // console.log("return faileddddd")
            // return res.status(404).json({ message: 'User or Password is wrong' });
            status = 'failed'
            messageLog = "User or Password is wrong"

            return res.status(req.statusCode).json({ message: messageLog });
        }

        if (username && role) {
            let user = {
                username,
                role
            };

            // console.log(user);
            const access_token = await jwtGenerateToken(user)
            console.log(access_token);

            const refresh_token = await jwtRefreshTokenGenerate(user)
            console.log(refresh_token);

            status = "success"

            return res.status(201).json({
                access_token: access_token,
                refresh_token: refresh_token,
                role: role
            });

        } else {
            status = 'failed'
            messageLog = "Internal server error"
            return res.status(500).send("Internal server error");
        }

    } catch (error) {
        console.log("error::", error);
        status = 'failed'
        messageLog = "Internal server error"

        return res.status(500).send("Internal server error")
    } finally {
        await logAuthen(username, page, url, action, status, messageLog)
    }
});


app.post("/api/refresh", jwtRefreshToken, async (req, res) => {
    try {
        console.log("in api");
        console.log("user :", req.user)

        let users = await getUserAll();
        console.log(users);

        const user = users.data.find(
            (e) => e.username === req.user.name
        )

        if (!user) return res.sendStatus(401)

        const access_token = jwtGenerateToken(user)
        const refresh_token = jwtRefreshTokenGenerate(user)

        return res.status(201).json({
            access_token: access_token,
            refresh_token: refresh_token,
            role: user.role
        });
    } catch (error) {
        console.log("error: ", error)
    }

});

app.post("/api/logging", jwtValidate, async (req, res) => {

    const { ipaddress, username, channel, page, url, action, status, message } = req.body;
    try {

        if(!username || !channel || !page || !url || !action || !status) {
            return res.status(400).send("Bad Request")
        }

        const logStatus = await logAuthen(username, channel, page, url, action, status,
                        !message || message.trim().length === 0 ? "" : message)

        console.log(logStatus);

        return res.status(201).json({
            message: "success"
        });


    } catch (error) {
        console.log("error::", error);
        return res.status(500).send("Internal server error")
    }
});

app.get("/api/authMenu", jwtValidate, async (req, res) => {

    const { username, role, url } = req.body;

    try {

        if (!username || !role || !url) {
            return res.status(400).json({ message: "Bad Request" })
        }

        const result = await userPermission(username, role, url);

        return res.status(result.statusCode).json({
            user: result.username,
            role: result.role,
            message: result.message
        });

    } catch (error) {
        console.log("[Error] ", error);
        return res.status(500).send("Internal server error")
    }
});




app.listen(PORT, () => {
    console.log(`Server started on ${PORT}`);
});