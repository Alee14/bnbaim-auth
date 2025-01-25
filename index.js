import express from "express";
import session from "express-session";
import multer from "multer";
import passport from "passport";
import { Strategy as DiscordStrategy } from "passport-discord";
import sqlite3 from 'sqlite3';
import path from "path";
import { fileURLToPath } from 'url';
import dotenv from "dotenv";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
dotenv.config();

// Load error messages from JSON file

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new sqlite3.Database('./database.db');

const upload = multer();
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));

db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL,
  aim_username TEXT NOT NULL
)`);

// Passport session setup
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Configure Passport Discord strategy
passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: process.env.REDIRECT_URI,
      scope: ["identify", "guilds"],
    },
    (accessToken, refreshToken, profile, done) => {
      return done(null, profile);
    }
  )
);

// Middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.get("/", async (req, res) => {
  if (req.isAuthenticated()) {
    const { id, guilds } = req.user;
    const isInGuild = guilds.some((guild) => guild.id === process.env.GUILD_ID);

    if (isInGuild) {
      db.get(`SELECT * FROM users WHERE discord_id = ?`, [id], (err, row) => {
        if (err) {
          console.error("Error querying the database:", err);
          return res.render('error', { error: 'An error occurred while checking user data.' });
        }

        if (row) {
          return res.render('dashboard', { ...req.user, aim_username: row.aim_username, serverName: process.env.SERVER_NAME || 'FreeSO' });
        } else {
          return res.render('register', req.user);
        }
      });
    } else {
      return res.render('error-login', { error: 'You must be a member of that server to access this page.' });
    }
  } else {
    res.render('index', { serverName: process.env.SERVER_NAME || 'AIM', discordName: process.env.DISCORD_NAME || 'Discord' });
  }
});

app.post("/register", async (req, res) => {
  if (req.isAuthenticated()) {
    const { id } = req.user;
    const { username, password, passwordconfirm } = req.body;

    if (password !== passwordconfirm) {
      return res.render('register', { ...req.user, error: "Passwords do not match" });
    }

    try {
      const response = await axios.post(`${process.env.API_URL}/user`, {
        screen_name: username,
        password: password
      });

      if (response.data.error) {
        const errorMessage = response.data;
        return res.render('register', { ...req.user, error: errorMessage });
      } else {
        db.run(`INSERT INTO users (discord_id, aim_username) VALUES (?, ?)`, [id, username], function(err) {
          if (err) {
            console.error("Error inserting user data into database:", err);
            return res.render('register', { ...req.user, error: "An error occurred during registration, contact server operator." });
          }
          return res.render('success', { ...req.user, success: "Created account successfully!"});
        });
      }
    } catch (error) {
      if (error.response) {
        const errorMessage = error.response.data;
        return res.render('register', { ...req.user, error: errorMessage });
      } else {
        console.error("Error during registration:", error);
        return res.render('register', { ...req.user, error: "An error occurred during registration, contact server operator." });
      }
    }
  } else {
    res.status(401).send("Unauthorized.");
  }
});

app.get('/password', (req, res) => {
  if (req.isAuthenticated()) {
    res.render('password');
  } else {
    res.redirect("/login");
  }
});

app.post('/password/change', async (req, res) => {
  if (req.isAuthenticated()) {
    const { id } = req.user;
    const { newpassword, newpassword2 } = req.body;

    if (newpassword !== newpassword2) {
      return res.render('password', { ...req.user, error: "Passwords do not match" });
    }

    try {
      db.get(`SELECT * FROM users WHERE discord_id = ?`, [id], async (err, row) => {
        if (err) {
          console.error("Error querying the database:", err);
          return res.render('password', {...req.user, error: "An error occurred while checking user data."});
        }

        if (row) {
          const form = new FormData();
          form.append('username', row.aim_username);
          form.append('new_password', newpassword);

          const response = await axios.put(`${process.env.API_URL}/user/password`, {
            screen_name: row.aim_username,
            password: newpassword
          });

          if (response.data.error) {
            const errorMessage = response.data;

            return res.render('password', { ...req.user, error: errorMessage });
          } else {
            return res.render('success', { ...req.user, success: "Password changed successfully!" });
          }
        }
      });
    } catch (error) {
      console.error("Error during password change:", error);
      return res.render('password', { ...req.user, error: "An error occurred during password change, contact server operator." });
    }
  } else {
    res.status(401).send("Unauthorized.");
  }
});

app.get(
  "/login",
  passport.authenticate("discord", { scope: ["identify", "guilds"] })
);

app.get(
  "/callback",
  passport.authenticate("discord", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect("/");
  }
);

app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect("/");
  });
});

const port = process.env.PORT;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
