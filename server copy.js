const express = require("express")
const app = express()
const path = require("path")
const port = process.env.PORT || 5000
const cors = require("cors")
const mongoose = require("mongoose")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcrypt")
const crypto = require("crypto")

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
app.use(cors())
app.use(express.json({ limit: "1mb" })) // Set a higher limit for request body
//app.use(express.urlencoded({ limit: "1mb", extended: true })) // Set a higher limit for URL-encoded data

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "../client/task-manager/public")))

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
      try {
        const users = await User.find({}, { password: 0 })
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
app.listen(port, () => console.log(`\nServer listening on port ${port}`))
