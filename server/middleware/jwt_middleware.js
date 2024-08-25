const jwt = require("jsonwebtoken")
// const { checkValidateUser } = require("../../controller")

//  generate new access token
const jwtGenerateToken = (user) => {

    console.log("user===", user);

    const accessToken = jwt.sign(
        { name: user.username, role: user.role },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.TIMEOUT_ACCESS_TOKEN, algorithm: "HS256" }
        // { expiresIn: "1d", algorithm: "HS256" }
    )

    return accessToken
}

//  generate new refresh token
const jwtRefreshTokenGenerate = (user) => {
    // console.log("token generate ", user);

    const refreshToken = jwt.sign(
        { name: user.username, role: user.role },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.TIMEOUT_SECRET_TOKEN, algorithm: "HS256" }
        // { expiresIn: "1d", algorithm: "HS256" }
    )

    return refreshToken
}


//  delete and recreate access token and refresh token
const jwtRefreshToken = (req, res, next) => {
    try {
        console.log("auth >>>>", req.headers["authorization"])
        if(!req.headers["authorization"])
            return res.sendStatus(401);

        console.log("get auth success");
        const token = req.headers["authorization"].replace("Bearer ", "")

        console.log("token:[", token);

        jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, (err, decoded) => {
            if(err) throw new Error(err)
            console.log("decoded: ", decoded);

            req.user = decoded
            req.user.token = token
            delete req.user.exp
            delete req.user.iat
        })

        console.log("Verify success===>")
        next()

    } catch (error) {
        console.log("error===>", error);
        return res.sendStatus(403)
    }
}

//  verify token from website
const jwtValidate = (req, res, next) => {
    try {
        const authHeader = req.headers["authorization"];
        if (!authHeader) return res.sendStatus(401);

        const token = authHeader.replace("Bearer ", "");

        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                console.log("=== token invalid ===");
                console.log(err);
                return res.sendStatus(403);
            }
            req.user = decoded; 
            next();
        });
    } catch (error) {
        console.log("=== token invalid ===");
        console.log(error);
        return res.sendStatus(403);
    }
};

// const jwtVerifyToken = (req, res, next) => {

// }


module.exports = { jwtGenerateToken, jwtRefreshTokenGenerate, jwtRefreshToken, jwtValidate }