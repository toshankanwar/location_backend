const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const jwt = require("jsonwebtoken"); // For authentication

// Initialize app
const app = express();
app.use(bodyParser.json());
app.use(cors());

// MongoDB Atlas connection
const mongoURI =
  "mongodb+srv://toshankanwar2003:Lifeisshort@cluster0.cj03j.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"; // Replace with your MongoDB URI
mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch((err) => console.error("Error connecting to MongoDB:", err));

// Models
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true, enum: ["driver", "user"] }, // Role: driver or user
});
const User = mongoose.model("User", userSchema);

const locationSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now },
});
const Location = mongoose.model("Location", locationSchema);

// Middleware for verifying JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(
    token,
    "6f2f1283e2d64456a47b9b889847fdee2d4a90c4dffb8bfc82c5a12d51e8f734",
    (err, user) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    }
  );
}

// Routes

// Registration routes
app.post("/api/auth/register/driver", async (req, res) => {
  const { username, password } = req.body;

  try {
    const newDriver = new User({ username, password, role: "driver" });
    await newDriver.save();
    res.status(201).json({ message: "Driver registered successfully!" });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Username already exists." });
    }
    res.status(500).json({ message: "Error registering driver", error });
  }
});

app.post("/api/auth/register/user", async (req, res) => {
  const { username, password } = req.body;

  try {
    const newUser = new User({ username, password, role: "user" });
    await newUser.save();
    res.status(201).json({ message: "User registered successfully!" });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Username already exists." });
    }
    res.status(500).json({ message: "Error registering user", error });
  }
});

// Login route for both users and drivers
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username, password });
    if (!user) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    // Generate a JWT with the user's role and username
    const token = jwt.sign(
      { username: user.username, role: user.role },
      "6f2f1283e2d64456a47b9b889847fdee2d4a90c4dffb8bfc82c5a12d51e8f734",
      { expiresIn: "1h" }
    );

    res.status(200).json({
      message: `${
        user.role.charAt(0).toUpperCase() + user.role.slice(1)
      } logged in successfully.`,
      token,
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ message: "Error logging in.", error });
  }
});

// Driver API to save location
app.post("/api/location", authenticateToken, async (req, res) => {
  if (req.user.role !== "driver") {
    return res
      .status(403)
      .json({ message: "Access denied. Only drivers can share locations." });
  }

  const { latitude, longitude } = req.body;

  try {
    const location = await Location.findOneAndUpdate(
      { username: req.user.username },
      { latitude, longitude, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.status(201).json({ message: "Location saved successfully", location });
  } catch (error) {
    res.status(500).json({ message: "Error saving location", error });
  }
});

// Stop sharing location
// Stop sharing location
// Stop sharing location
app.post("/api/location/stop", authenticateToken, async (req, res) => {
  if (req.user.role !== "driver") {
    return res
      .status(403)
      .json({
        message: "Access denied. Only drivers can stop sharing locations.",
      });
  }

  const username = req.user.username;

  try {
    // Delete all location data for the driver
    const result = await Location.deleteMany({ username });

    if (result.deletedCount === 0) {
      return res
        .status(404)
        .json({ message: "No location data found for the driver." });
    }

    res.status(200).json({
      message: "Location sharing stopped, and all data removed successfully.",
    });
  } catch (error) {
    console.error("Error stopping location sharing:", error);
    res.status(500).json({ message: "Failed to stop location sharing." });
  }
});

// User API to retrieve all driver locations
app.get("/api/location", authenticateToken, async (req, res) => {
  if (req.user.role !== "user") {
    return res.status(403).json({
      message: "Access denied. Only users can view driver locations.",
    });
  }

  try {
    // Retrieve only active driver locations from the database
    const locations = await Location.find().sort({ updatedAt: -1 });
    res.status(200).json(locations);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving locations", error });
  }
});

// Start the server
const PORT = 5000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
