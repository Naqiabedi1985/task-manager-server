const express = require("express")
const app = express()
const path = require("path")
const port = process.env.PORT || 5000
const cors = require("cors")
const mongoose = require("mongoose")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcrypt")
const crypto = require("crypto")
const passport = require("passport")
const GoogleStrategy = require("passport-google-oauth20").Strategy
const axios = require("axios")
const https = require("https")
const fs = require("fs")

const options = {
  key: fs.readFileSync("C:/Users/naqia/openssl/key.pem"),
  cert: fs.readFileSync("C:/Users/naqia/openssl/cert.pem"),
}

// Load environment variables from .env file
require("dotenv").config({ path: __dirname + "/../.env" })

const secret_Key = process.env.SECRET_KEY
const dbConnection_String = process.env.DB_CONNECTION_STRING

console.log(
  `\nsecret_Key: ${secret_Key} \n dbConnection_String: ${dbConnection_String}`
)

// Connect to MongoDB
mongoose.connect(dbConnection_String)

// Define User model
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  dateOfBirth: { type: String, required: true },
  userRole: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
})

const User = mongoose.model("User", UserSchema)

// Define the Task schema
const taskSchema = new mongoose.Schema({
  Task: String,
  Owner: String,
  Status: String,
  Timeline: Date,
  Duration: Number,
  "Dependent On": [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    },
  ],
  "Planned Effort": Number,
  "Effort Spent": Number,
  "Completion Date": Date,
  "Completion Status": String,
})

// Create a Task model
const Task = mongoose.model("Task", taskSchema)

// Use the Task model in your API routes or other parts of your application

//app.use(express.json())
app.use(
  cors({
    exposedHeaders: "Cross-Origin-Opener-Policy",
  })
)

app.use(express.json({ limit: "1mb" })) // Set a higher limit for request body
//app.use(express.urlencoded({ limit: "1mb", extended: true })) // Set a higher limit for URL-encoded data

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "../client/task-manager/public")))

//server is serving the required headers by adding the following middleware code before your route handlers
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin")
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp")
  next()
})

//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
// Configure Google OAuth strategy
passport.use(
  new GoogleStrategy(
    {
      clientID:
        "859162789948-gs9b0erka3q4lnebn870hdpqop0eruqo.apps.googleusercontent.com",
      clientSecret: "GGOCSPX-31CL7T4JxcOLyY7XkXZJ7dChI5_n",
      callbackURL: "https://myapp.com:5000/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log(
          "\n\n passport.use(  new GoogleStrategy(    { async accessToken, refreshToken, profile, done) => { is called"
        )
        const email = profile.emails[0].value

        // Check if the user already exists in the database
        const existingUser = await User.findOne({ email })
        if (existingUser) {
          // User already exists, no need to create a new user
          return done(null, existingUser)
        }

        // User does not exist, create a new user document
        const newUser = new User({
          name: profile.displayName,
          email: email,
          dateOfBirth: "1980-12-25",
          userRole: "user",
          password: "abcde123",
        })

        // Save the user to the database
        await newUser.save()

        done(null, newUser)
      } catch (error) {
        done(error)
      }
    }
  )
)

// Route for Google Sign-In
app.get("/auth/google", (req, res) => {
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res)
  console.log("\n\n app.get('/auth/google', () => { is called")
})

// Callback route after Google Sign-In
app.get("/auth/google/callback", async (req, res, next) => {
  console.log("\n\napp.get('/auth/google/callback', async () => { is called")
  await passport.authenticate("google", { failureRedirect: "/login" })(
    req,
    res,
    next
  )
  res.redirect("/login")
})

// Handle the Google User Info API endpoint
app.post("/api/google/userinfo", async (req, res) => {
  const { accessToken } = req.body

  console.log(
    `\n\n request made to endpoint "app.post(/api/google/userinfo)" accessToken is: ${accessToken}`
  )

  // Validate the access token (you might want to add more checks here)
  if (!accessToken) {
    return res.status(400).json({ error: "Access token is missing" })
  }

  try {
    // Make a request to Google's API to get the user information
    const response = await axios.get(
      `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`,
      {
        headers: {
          "Content-Security-Policy":
            "connect-src https://accounts.google.com/gsi/; frame-src https://accounts.google.com/gsi/; script-src https://accounts.google.com/gsi/client; style-src https://accounts.google.com/gsi/style;",
        },
      }
    )

    // Extract the relevant user data
    const { name, email } = response.data
    console.log(`\nGoogle login: name = ${name} email = ${email}`)

    // Check if the user already exists in the database
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.json({ name, email })
    }

    // Create a new User document with the retrieved information
    const newUser = new User({
      name: name,
      email: email,
      dateOfBirth: "1980-12-25",
      userRole: "user",
      password: "abcde123",
    })

    // Save the user to the database
    await newUser.save()

    // Send the user information back to the client
    res.json({ name, email })
  } catch (error) {
    console.error("Error:", error)
    res.status(500).json({ error: "Failed to retrieve user information" })
  }
})

//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////

// Register a new user
app.post("/register", async (req, res) => {
  try {
    console.log("\nRegistration route called")

    const { name, dateOfBirth, userRole, email, password } = req.body

    // Validate input fields
    if (!name || !dateOfBirth || !userRole || !email || !password) {
      return res
        .status(400)
        .json({ success: false, error: "All fields are required" })
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, error: "User already exists" })
    }

    // Create a new user
    const hashedPassword = await bcrypt.hash(password, 10)
    const newUser = new User({
      name,
      dateOfBirth,
      userRole,
      email,
      password: hashedPassword,
    })
    await newUser.save()

    // Generate JWT token
    const token = jwt.sign({ userId: newUser._id }, secret_Key)

    res.json({ success: true, message: "Registration successful", token })
  } catch (error) {
    console.log(`\n${error}`)
    res.status(500).json({ success: false, error: "Internal server error" })
  }
})

// Login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body

    // Validate input fields
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, error: "Email and password are required" })
    }

    // Check if user exists
    const user = await User.findOne({ email })
    if (!user) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid credentials" })
    }

    // Compare passwords
    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid credentials" })
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, secret_Key)

    res.json({ success: true, message: "Login successful", token })
  } catch (error) {
    console.log(`\n${error}`)
    res.status(500).json({ success: false, error: "Internal server error" })
  }
})

// Get all users
app.get("/users", async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 })
    res.json({ success: true, data: users })
  } catch (error) {
    console.log(`\n${error}`)
    res.status(500).json({ success: false, error: "Internal server error" })
  }
})

// Get all tasks

app.get("/tasks", async (req, res) => {
  try {
    const tasks = await Task.find()
    console.log("\nTASK from 'const tasks = await Task.find()' : ", tasks) // Add this line to inspect the tasks variable

    res.json({ success: true, data: Array.isArray(tasks) ? tasks : [tasks] })
  } catch (error) {
    console.log(`\n${error}`)
    res.status(500).json({ success: false, error: "Internal server error" })
  }
})

// Require authentication for the routes inside

app.use((req, res, next) => {
  const token = req.headers.authorization.split(" ")[1]
  console.log(`\nserver.js >> token: ${token}`)
  //const token = req.headers.authorization
  if (!token) {
    return res.status(401).json({ success: false, error: "Unauthorized" })
  }

  try {
    const decoded = jwt.verify(token, secret_Key)
    console.log("\ndecoded token: ", decoded)

    req.userId = decoded.userId

    // Get user profile
    app.get("/profile", async (req, res) => {
      try {
        const user = await User.findById(req.userId)
        if (!user) {
          return res
            .status(404)
            .json({ success: false, error: "User not found" })
        }
        res.json({
          success: true,
          data: {
            name: user.name,
            dateOfBirth: user.dateOfBirth,
            userRole: user.userRole,
            email: user.email,
          },
        })
      } catch (error) {
        console.log(`\n${error}`)
        res.status(500).json({ success: false, error: "Internal server error" })
      }
    })

    // Get all users
    app.get("/dashboard", async (req, res) => {
      console.log("\nAPI call to /dashboard happened")
      try {
        const users = await User.find({}, { password: 0 })
        console.log("\nusers retreived from DB in /dashbaord:  ", users)
        res.json({ success: true, data: users })
      } catch (error) {
        console.log(`\n${error}`)
        res.status(500).json({ success: false, error: "Internal server error" })
      }
    })

    // Edit user
    app.put("/dashboard/:userId", async (req, res) => {
      try {
        const { userId } = req.params
        const { name, dateOfBirth, userRole, email } = req.body

        // Find the user by ID
        const user = await User.findById(userId)
        if (!user) {
          return res
            .status(404)
            .json({ success: false, error: "User not found" })
        }

        // Update user details
        user.name = name
        user.dateOfBirth = dateOfBirth
        user.userRole = userRole
        user.email = email

        // Save the updated user
        await user.save()

        res.json({ success: true, message: "User updated successfully" })
      } catch (error) {
        console.log(`\n${error}`)
        res.status(500).json({ success: false, error: "Internal server error" })
      }
    })

    // Delete user
    app.delete("/dashboard/:userId", async (req, res) => {
      try {
        const { userId } = req.params

        // Find the user by ID and remove it
        const user = await User.findByIdAndRemove(userId)
        if (!user) {
          return res
            .status(404)
            .json({ success: false, error: "User not found" })
        }

        res.json({ success: true, message: "User deleted successfully" })
      } catch (error) {
        console.log(`\n${error}`)
        res.status(500).json({ success: false, error: "Internal server error" })
      }
    })

    next()
  } catch (error) {
    console.log(`\n${error}`)
    res.status(401).json({ success: false, error: "Unauthorized" })
  }
})

// console.log that your server is running
/*
https.createServer(options, app).listen(port, () => {
  console.log(`\nServer listening on port ${port} over HTTPS`)
})
*/
// console.log that your server is running
app.listen(port, () => console.log(`\nServer listening on port ${port}`))
