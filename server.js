require('dotenv').config();

const express = require('express');
//import {sqlInit} from "./handleSql.js";
//const sqlCustom = require("./handleSql.js");
const https = require('https');
const fs = require('fs');
const path = require('path');

const rateLimit = require('express-rate-limit');
const validator = require('validator');

const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// Create an instance of the Express application
const app = express();
const helmet = require('helmet');

// Configure Helmet with a custom Content Security Policy
app.use(
   helmet({
       contentSecurityPolicy: {
             directives: {
                     styleSrc: ["'self'", "https://cdn.tailwindcss.com", "'unsafe-inline'"], // 'unsafe-inline' is often needed for Tailwind's JIT mode or other inline styles
                     scriptSrc: ["'self'", "https://cdn.tailwindcss.com", "'unsafe-inline'"], 
		      styleSrc: ["'self'", "https://cdn.tailwindcss.com", "'unsafe-inline'"],
		     connectSrc: ["'self'", 'http://localhost:3000/api/message',"'unsafe-inline'"],
		     connectSrc: ["'self'", 'http://localhost:3000/api/some', "'unsafe-inline'"],
		     // Add other directives as needed (e.g., img-src, connect-src, etc.)
                                                             defaultSrc: ["'self'"], // Uncomment and customize if you want a default source
	     },
         },
 }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

app.use(express.json());


// Enable trust proxy for Vercel deployment
app.set('trust proxy', 1);


// IP Rate Limiter: Max 5 signups per 15 mins per IP
const waitlistLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});


// Middleware to enable CORS (Cross-Origin Resource Sharing)
// This is necessary to allow the frontend (running on a different origin,
// or directly from a file) to make requests to this backend.
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // Allow all origins for simplicity in this basic example
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

app.use(express.static(__dirname+'/public'));

// Define a simple API endpoint
/*
app.get('/api/message', (req, res) => {
    // Send a JSON response
    res.json({ message: 'Hello from the Node.js Backend!\nTop of the morning to you!'});

});*/

// Setup Google Sheets Authentication
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID, serviceAccountAuth);

// Waitlist POST endpoint
app.post('/api/waitlist', async (req, res) => {
  try {
    const { email,website } = req.body || {};

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
	  /*
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SPREADSHEET_ID;

  console.log('Service Account Email:', email ? `✅ Found (${email})` : '❌ MISSING');
  console.log('Private Key:', key ? `✅ Found (Length: ${key.length} characters)` : '❌ MISSING');
  console.log('Spreadsheet ID:', sheetId ? `✅ Found (${sheetId})` : '❌ MISSING');*/
    // 1. Honeypot check (Catches automated bots)
    if (website) {
      return res.status(200).json({ success: true, message: 'Successfully joined the waitlist!' });
    }

    // 2. Email format validation
    if (!email || !validator.isEmail(email) || email.length > 254) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    const cleanEmail = email.trim().toLowerCase();
	 
    // 3. Append to Google Sheet
    await doc.loadInfo(); // Loads document properties and sheets
    const sheet = doc.sheetsByIndex[0]; // Targets the first tab/sheet
    
    const rows = await sheet.getRows(); // Fetches all current rows
    const existingUser = rows.find(row => row.get('Email').toLowerCase() === cleanEmail);

    if (existingUser) {
      return res.status(200).json({ 
        success: true, 
        message: "You're already on the waitlist!" 
      });
    }

    await sheet.addRow({
      Email: email,
      Date: new Date().toISOString(),
    });
	  
    // TODO: Connect your database here (e.g., Supabase, MongoDB, or Firebase)
    console.log('Waitlist signup received:', email);

    return res.status(200).json({ 
      success: true, 
      message: 'Successfully joined the waitlist!' 
    });
  } catch (error) {
    console.error('Google Sheets Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/status',(req,res) => {
	res.json({
		    status: 'operational',
		    timestamp: new Date().toISOString(),
		    environment: process.env.NODE_ENV || 'development',
		    nodeVersion: process.version
	});

});

app.get('/api/some',(req,res) => {
	res.json({ message: 'hello gordan'});


});

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html');
        //res.status(200).json({message: 'User data.'});
});

// Error handling middleware
 app.use((err, req, res, next) => {
   console.error(err.stack);
     res.status(500).json({ error: 'Something went wrong!' });
});

     // 404 handler
app.use((req, res) => {
       res.status(404).json({ error: 'Not Found' });
});

const HOST = process.env.HOST || '0.0.0.0';


if(fs.existsSync('testingTutorials/key.pem') && fs.existsSync('testingTutorials/cert.pem')) {
       // SSL/TLS options
   const sslOptions = {
        key: fs.readFileSync(path.join(__dirname, 'testingTutorials/key.pem')),
        cert: fs.readFileSync(path.join(__dirname, 'testingTutorials/cert.pem')),
        // Enable HTTP/2 if available
        allowHTTP1: true,
        // Recommended security options
        minVersion: 'TLSv1.2',
        ciphers: [
        'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256',
        'TLS_AES_128_GCM_SHA256',
                                     'ECDHE-RSA-AES128-GCM-SHA256',
                                         '!DSS',
                                             '!aNULL',
                                                 '!eNULL',
                                                     '!EXPORT',
   '!DES',
   '!RC4',
   '!3DES',
    '!MD5',
    '!PSK'
     ].join(':'),
     honorCipherOrder: true
  };

  const server = https.createServer(sslOptions, app);

	// Start the server and listen for incoming requests
   server.listen(PORT, HOST, () => {
    console.log(`Backend server running on https://localhost:${PORT}`);
    console.log(`Frontend accessible at https://localhost:${PORT}`);
   });


}
else
{
	app.listen(PORT, HOST, () => {
    console.log(`Backend server running on https://localhost:${PORT}`);
    console.log(`Frontend accessible at https://localhost:${PORT}`);
    
   });
}

