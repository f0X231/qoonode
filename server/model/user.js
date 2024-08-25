const userRole = {
    type: String,
    enum: ["user", "admin", "super_admin"],
    default: "user"
}

module.export = userRole