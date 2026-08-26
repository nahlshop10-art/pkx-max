# Cloudflare Deployment Master Guide

Congratulations on upgrading your website to a fully-featured, Cloudflare-deployed application! Your application is now designed to run entirely on Cloudflare's Edge using Cloudflare Pages, D1 (SQL Database), and R2 (Image Storage). Local storage and IndexedDB bottlenecks have been replaced with a cloud synchronization module (`cloudStore.ts`), ensuring scalability mapping perfectly across mobile and desktop. 

Follow this complete step-by-step guide to bring this setup onto your real Cloudflare account.

## Step 1: Export Your Project
1. In the AI Studio editor, look for the **Export** or **Download** option (usually in the settings menu or top right corner).
2. Download the project as a `.zip` file to your computer.
3. Extract the `.zip` file on your local machine. 

## Step 2: Upload to GitHub
1. Create an account at [GitHub.com](https://github.com/) if you don't have one.
2. In the top right corner, click the **+** icon and select **New repository**.
3. Name your repository (e.g., `paikarix-store`), set it to **Private** (recommended since it's an ecommerce site), and click **Create repository**.
4. On your computer, open your Terminal (Mac/Linux) or Command Prompt / Git Bash (Windows) and navigate into the extracted project folder.
5. Alternatively, you can use **GitHub Desktop** or simply **drag and drop** the extracted files into the new GitHub repository page using the "uploading an existing file" option on GitHub. 
   *(Make sure you upload ALL files including `package.json`, `index.html`, `wrangler.toml`, etc.)*

## Step 3: Create Cloudflare Account
1. Go to [Cloudflare.com](https://dash.cloudflare.com/sign-up) and sign up for a free account.
2. Verify your email address.

## Step 4: Create the D1 Database (SQL)
1. In your Cloudflare Dashboard, look at the left sidebar menu. 
2. Click on **Workers & Pages** -> **D1**.
3. Click **Create Database** (you may be asked to enable billing, but you get a generous free tier of 5 million reads/day).
4. Name the database `paikarix-db` (Dashboard Location: Auto).
5. Once created, you will see a **Database ID** (a long string of characters). Copy this value!
6. Go to your GitHub repository and edit `wrangler.toml`. Find `database_id = "YOUR_DATABASE_ID_HERE"` and replace the placeholder with your copied Database ID.

## Step 5: Execute the Database Schema
1. On the Cloudflare D1 dashboard for your `paikarix-db`, click on the **Console** tab.
2. Open the `schema.sql` file you downloaded in Step 1. Copy ALL of the text inside `schema.sql`.
3. Paste the contents into the Cloudflare D1 SQL Console and click **Execute**. 
4. *Success! The tables (`products`, `orders`, `settings`) have been created in your Cloudflare Database.*

## Step 6: Create the R2 Bucket (Image Storage)
1. In the Cloudflare Dashboard left sidebar, click on **R2**. (You may need to add a credit card to activate R2, but the first 10GB is completely free every month).
2. Click **Create bucket**.
3. Name the bucket exactly `paikarix-images` (to match the name in `wrangler.toml`).
4. Click **Create bucket**.
5. Once inside the bucket page, click on the **Settings** tab.
6. Scroll down to **Public Access** -> **Custom Domains**.
   - If you have a custom domain on Cloudflare, click **Connect Domain**.
   - Alternatively, under **R2.dev subdomain**, click **Allow Access**. An alert will pop up. Type "allow" to confirm. 
7. Copy the public URL (e.g., `https://pub-yourcode.r2.dev`).
8. You can optionally add this domain to the workers script via Cloudflare Pages environment variables (`R2_PUBLIC_DOMAIN` = `pub-yourcode.r2.dev`).

## Step 7: Deploy to Cloudflare Pages
1. Go back to **Workers & Pages**.
2. Click **Create** -> **Pages** -> **Connect to Git**.
3. Connect your GitHub account and select the `paikarix-store` repository you uploaded in Step 2.
4. Click **Begin setup**.
5. **Configure the Project Build Settings:**
   - **Framework Preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
6. Scroll down to **Environment Variables (Advanced)**. Add your API keys here:
   - `GEMINI_API_KEY` (Your Google AI Studio Key)
7. Make sure Cloudflare recognizes the `paikarix-db` and `paikarix-images` bindings. Cloudflare Pages automatically links them if `wrangler.toml` is in the repository! 
   *(If not, after deployment, you can go to your Pages project -> Settings -> Functions -> D1 database bindings / R2 bucket bindings and add them manually with variable name `DB` for D1 and `BUCKET` for R2).*
8. Click **Save and Deploy**.

## Step 8: Finalizing
Your site will start building! It takes about 2-3 minutes. Once finished, Cloudflare will provide you with a `.pages.dev` URL where your full-stack live store is running, backed by D1 SQLite and R2 image storage.

Local testing tip: If you want to run this locally on your own machine in the future, you can type:
```bash
npm install
npx wrangler pages dev dist
```

You've successfully completed a full migration. Congratulations!
