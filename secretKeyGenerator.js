const fs = require("fs")
const crypto = require("crypto")

const generateSecretKey = () => {
  const secret = crypto.randomBytes(32).toString("hex")
  return secret
}

const secretKey = generateSecretKey()
fs.writeFileSync(".env", `SECRET_KEY=${secretKey}`)
