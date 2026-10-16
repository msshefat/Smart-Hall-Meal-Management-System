# Smart Hall Meal Management System

A residential hall dining system built with **React**, **Express**, and **MongoDB**.

Students turn breakfast, lunch, and dinner on or off before a cutoff. Mess staff enter the daily bazar. The rate is `floor(bazar ÷ students on that meal)`. Paisa that does not divide evenly stays on the report. Staff and administrators can download that report as a CSV file. An administrator can move the lock times at any time, and open meals follow the new cutoff immediately.

New students request an account with a name, email, ID, a photo of that ID card, a mobile number, and a password. A profile photo is optional. Each picture must be a JPG or PNG of 1 MB or smaller. A star marks every required field. They can sign in only after an administrator approves the request. Anyone who is signed in can edit their own name, room, mobile number, and password from Profile. An ID can be changed only by an administrator. An administrator can delete any profile except their own.

A student can ask to add money from Expenses. The amount is credited only after an administrator approves it on Balances.

A negative balance can still order meals until it goes past −500tk. Past that, new meals stay closed and a warning stays on screen. Turning a meal off is still allowed.

After a person eats, mess staff search that ID on Meal taken. The profile photo is shown so the counter can confirm the person, then the meal is marked served. That meal stays on the list and cannot be taken a second time the same day. Students cannot switch a taken meal off.

The earlier MySQL version stays in its own repository: [hall-meal](https://github.com/msshefat/hall-meal).

## Stack

React, Vite, Express, MongoDB, Mongoose. Meal times use Bangladesh Standard Time (UTC+6).

## Run it on your computer

1. Install [Node.js 18+](https://nodejs.org) and [MongoDB Community Server](https://www.mongodb.com/try/download/community). Start MongoDB so it listens on `127.0.0.1:27017`.
2. Copy this whole folder. Copy `.env.example` to `.env`.
3. In this folder, run:

   ```bash
   npm install
   npm install --prefix server
   npm install --prefix client
   npm run seed
   npm run dev
   ```

4. Open http://127.0.0.1:47240

`npm run seed` fills demonstration accounts, menus, a few days of orders, and posted bazar costs. Run it again with `npm run seed -- --force` to replace that demo data.

The rate calculation uses a short lock so two saves cannot charge the same meal twice. If MongoDB is running as a replica set, the charge and the balance update commit together. A normal standalone MongoDB install still works.



## How the rate works

`rate = floor(bazar in paisa / students marked on)`

Each of those students is charged that rate. Paisa that does not divide evenly is stored as undistributed and shown on the report. Saving a cost, or correcting the meal sheet after a cost exists, recalculates that meal and rewrites the charges.

A negative balance is an amount due. There is no online payment gateway in this version.
