// Required dependencies
const express = require("express") // Line 1: Importing the Express module
const app = express() // Line 2: Creating an instance of the Express application
const path = require("path") // Line 3: Importing the path module
const port = process.env.PORT || 5000 // Line 4: Setting the port for the server
const cors = require("cors") // Line 5: Importing the CORS module
const mongoose = require("mongoose") // Line 6: Importing the Mongoose module
const jwt = require("jsonwebtoken") // Line 7: Importing the JSON Web Token (JWT) module
const bcrypt = require("bcrypt") // Line 8: Importing the bcrypt module for password hashing

// Connect to MongoDB
mongoose.connect("mongodb://localhost/task-manager-db") // Line 11: Connecting to the MongoDB database

// Define User model
const UserSchema = new mongoose.Schema({
  // Line 14: Defining a schema for the User model
  email: String,
  password: String,
})

const User = mongoose.model("User", UserSchema) // Line 18: Creating a User model based on the UserSchema

app.use(express.json()) // Line 21: Using Express middleware to parse JSON data in the request body
app.use(cors()) // Line 22: Using CORS middleware to allow Cross-Origin Resource Sharing

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "../client/task-manager/public"))) // Line 26: Serving static files from the specified directory

// Register a new user
app.post("/register", async (req, res) => {
  // Line 29: Handling the HTTP POST request for '/register'
  try {
    const { email, password } = req.body // Line 32: Extracting email and password from the request body

    // Check if user already exists
    const existingUser = await User.findOne({ email }) // Line 35: Checking if a user with the same email exists
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" }) // Line 36: Returning an error if the user already exists
    }

    // Create a new user
    const hashedPassword = await bcrypt.hash(password, 10) // Line 40: Hashing the password with bcrypt
    const newUser = new User({ email, password: hashedPassword }) // Line 41: Creating a new User instance
    await newUser.save() // Line 42: Saving the new user to the database

    res.json({ message: "User registered successfully" }) // Line 44: Sending a JSON response
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "Internal server error" }) // Line 48: Handling errors with an error response
  }
})

// Login
app.post("/login", async (req, res) => {
  // Line 51: Handling the HTTP POST request for '/login'
  try {
    const { email, password } = req.body // Line 54: Extracting email and password from the request body

    // Check if user exists
    const user = await User.findOne({ email }) // Line 57: Finding a user with the specified email
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" }) // Line 58: Returning an error if the user does not exist
    }

    // Compare passwords
    const passwordMatch = await bcrypt.compare(password, user.password) // Line 62: Comparing the provided password with the stored password
    if (!passwordMatch) {
      return res.status(400).json({ error: "Invalid credentials" }) // Line 63: Returning an error if the passwords do not match
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, "secretkey") // Line 67: Generating a JWT token with the user ID

    res.json({ token }) // Line 69: Sending the JWT token in the response
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "Internal server error" }) // Line 73: Handling errors with an error response
  }
})

// Require authentication for the routes below
app.use((req, res, next) => {
  // Line 76: Middleware to require authentication for subsequent routes
  const token = req.headers.authorization // Line 77: Extracting the token from the request headers
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" }) // Line 79: Returning an error if the token is missing
  }

  try {
    const decoded = jwt.verify(token, "secretkey") // Line 81: Verifying the JWT token
    req.userId = decoded.userId // Line 82: Adding the user ID to the request object
    next() // Line 83: Proceeding to the next middleware/route handler
  } catch (error) {
    console.log(error)
    res.status(401).json({ error: "Unauthorized" }) // Line 86: Handling errors with an error response
  }
})

// Get user profile
app.get("/profile", async (req, res) => {
  // Line 89: Handling the HTTP GET request for '/profile'
  try {
    const user = await User.findById(req.userId) // Line 92: Finding the user based on the user ID
    res.json({ email: user.email }) // Line 93: Sending the user's email in the response
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "Internal server error" }) // Line 97: Handling errors with an error response
  }
})

// Start the server
app.listen(port, () => console.log(`App listening on port ${port}`)) // Line 100: Starting the server and logging a message
