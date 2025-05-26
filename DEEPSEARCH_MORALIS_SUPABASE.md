

# Integrating Moralis Authentication with Supabase in an Expo React Native App

This guide shows how to enable **wallet-based login (MetaMask only)** in an Expo React Native (TypeScript) app across Web, Android, and iOS. We use **Moralis’s Auth API** for Web3 (EVM) authentication and **Supabase** for session management and user data. When the user taps “Connect Wallet,” Moralis handles the message challenge/signature, and upon verification the backend creates or finds a Supabase user and issues a JWT. The frontend then uses this JWT with Supabase to manage the session. Additional profile data (username, avatar, game stats, etc.) are stored in a Supabase table. We use only free tiers of Moralis and Supabase.

**Key technologies:** Moralis Auth API (free tier)[developers.moralis.com](https://developers.moralis.com/supabase-authentication-how-to-authenticate-users-on-supabase/#:~:text=Request%20message%3A)[developers.moralis.com](https://developers.moralis.com/supabase-authentication-how-to-authenticate-users-on-supabase/#:~:text=The%20Web3%20authentication%20flow%20is,and%20adds%20it%20to%20Supabase), Supabase (Postgres, Auth, RLS), WalletConnect (mobile MetaMask bridge), React Native (Expo), TypeScript.

## Prerequisites

-   **Moralis account:** Sign up at Moralis.io (free) and obtain a **Web3 API key** (Moralis Dashboard → Web3 APIs). This key authenticates calls to Moralis Auth API.
    
-   **Supabase project:** Create a free Supabase project at app.supabase.com. Note your **Project URL**, **anon/public key**, **service_role key**, and **JWT secret** (Dashboard → Settings → API).
    
-   **Expo React Native environment:** Node.js, npm or Yarn, and `expo-cli`. Initialize a new Expo project with TypeScript: e.g. `expo init myDapp –-template expo-template-blank-typescript`.
    
-   **Dependencies:** We will install Moralis, `@supabase/supabase-js`, `ethers` (or `web3`), and WalletConnect (`@walletconnect/react-native-dapp`). For example:
    

-   `yarn add moralis @supabase/supabase-js ethers
    expo install @walletconnect/react-native-dapp @react-native-async-storage/async-storage` 
    
-   **MetaMask:** On web, MetaMask browser extension. On mobile (iOS/Android), the MetaMask app (connected via WalletConnect).
    

## 1. Moralis Setup (Free Tier)

1.  **Sign up and get API key:** Register at Moralis and under **Web3 APIs**, copy your **Moralis API Key**. The free Starter Plan (10M calls/month) covers authentication use[forum.moralis.io](https://forum.moralis.io/t/free-and-pro-tier-limits/8932#:~:text=Free%20and%20pro%20tier%20limits,both%20node%20and%20API%20calls).
    
2.  **Install Moralis SDK:** In your backend (Node.js) project install `moralis`:
    

-   `yarn add moralis` 
    
-   **Initialize Moralis:** In your Node server code, start Moralis with your API key (keep it secret):
    

-   `import  Moralis  from  'moralis'; Moralis.start({ apiKey: process.env.MORALIS_API_KEY });` 
    
-   **RequestMessage & Verify:** Use Moralis Auth API to create a login challenge and verify the signature. For example (server-side):
    

1.  `// 1) Request a nonce/challenge from Moralis  const { message } = await  Moralis.Auth.requestMessage({ address: walletAddress, chain: "0x1", // Ethereum Mainnet chain ID  network: "evm", domain: "mydapp.com", statement: "Please sign this message to log in to MyDApp.",
    }); // 2) Client signs this message with MetaMask, then sends the signature back.  // 3) Verify on server:  const verifiedData = await  Moralis.Auth.verify({
      message, 
      signature, network: "evm" }); // verifiedData.address has the wallet address (if valid)` 
    
    This matches the Moralis docs usage: `Moralis.Auth.requestMessage(...)` and `Moralis.Auth.verify(...)`[developers.moralis.com](https://developers.moralis.com/supabase-authentication-how-to-authenticate-users-on-supabase/#:~:text=Request%20message%3A). Moralis complies with EIP-4361 (SIWE).
    

> **References:** The Moralis Auth API simplifies Web3 login flows – it sends a challenge message and verifies the signed response[developers.moralis.com](https://developers.moralis.com/supabase-authentication-how-to-authenticate-users-on-supabase/#:~:text=Request%20message%3A). For example, calling `Moralis.Auth.requestMessage` and `Moralis.Auth.verify` handles the message flow[developers.moralis.com](https://developers.moralis.com/supabase-authentication-how-to-authenticate-users-on-supabase/#:~:text=Request%20message%3A). Moralis’s own tutorial explains that after the user signs, it issues a JWT to check/create a Supabase user[developers.moralis.com](https://developers.moralis.com/supabase-authentication-how-to-authenticate-users-on-supabase/#:~:text=The%20Web3%20authentication%20flow%20is,and%20adds%20it%20to%20Supabase).

## 2. Supabase Setup

1.  **Database table for users:** In your Supabase project, create a table to store user profiles. For simplicity (as in Moralis’s example), we create a `users` table with columns for an auto-generated `id`, a `moralis_provider_id` (the wallet address), and a `metadata` JSON for extra info. In SQL editor, run:
    

-   `create  table public.users (
      id bigint generated by  default  as  identity,
      created_at timestamptz not  null  default now(),
      moralis_provider_id text null,
      metadata jsonb null, primary key (id)
    ); alter  table public.users enable row level security; create policy "Users can view their own record" on public.users for  select  using ((auth.jwt() ->>  'id')::bigint  = id);` 
    
    This sets up RLS so each user can only read their own row (matching the JWT’s `id` claim)[moralisweb3.github.io](https://moralisweb3.github.io/Moralis-JS-SDK/demos/supabase-auth/#:~:text=create%20table%20public,id%29%20%29%20tablespace%20pg_default)[moralisweb3.github.io](https://moralisweb3.github.io/Moralis-JS-SDK/demos/supabase-auth/#:~:text=alter%20table%20,level%20security). You should similarly add policies to allow **INSERT** or **UPDATE** on a user’s own row.
    
-   **Supabase credentials:** From the Supabase dashboard (Project Settings → API), note:
    
    -   `SUPABASE_URL` (e.g. `https://xyz.supabase.co`)
        
    -   `SUPABASE_PUBLIC_ANON_KEY`
        
    -   `SUPABASE_SERVICE_KEY` (service_role)
        
    -   `SUPABASE_JWT_SECRET` (the JWT secret).
        
-   **Row-Level Security:** Ensure RLS is enabled (as above) and policies allow authenticated access. For example, you may also add a policy:
    

1.  `create policy "Users can update their own metadata" on public.users for  update  using ((auth.jwt() ->>  'id')::bigint  = id);` 
    
    With these, any JWT that includes `"id": <userId>` in its payload will be able to select/update only that row.
    

> **References:** The Moralis Supabase-auth example recommends a `users` table with a JSON `metadata` column and RLS on `(auth.jwt() ->> 'id')::bigint = id`[moralisweb3.github.io](https://moralisweb3.github.io/Moralis-JS-SDK/demos/supabase-auth/#:~:text=create%20table%20public,id%29%20%29%20tablespace%20pg_default)[moralisweb3.github.io](https://moralisweb3.github.io/Moralis-JS-SDK/demos/supabase-auth/#:~:text=alter%20table%20,level%20security). This ensures only the logged-in user (based on JWT) can read or modify their record.

## 3. Backend: Auth & Session Logic

Create a simple Node/Express (or similar) backend with two endpoints: **`/request-message`** and **`/verify`**. Use environment variables for Moralis and Supabase keys (e.g. with a `.env` file as in the Moralis demo[developers.moralis.com](https://developers.moralis.com/supabase-authentication-how-to-authenticate-users-on-supabase/#:~:text=SUPABASE_PUBLIC_ANON_KEY%20%3D%20%27%27)).

### a. Request message endpoint

This endpoint takes a wallet address (and optionally chain) and calls Moralis to get a challenge message. Example using Express:

`// server.ts (Express, TypeScript)  import express from  'express'; import  Moralis  from  'moralis'; const app = express();
app.use(express.json());

app.post('/api/request-message', async (req, res) => { const { address, chain = '0x1', network = 'evm' } = req.body; if (!address) return res.status(400).send("Address required"); try { const { message } = await  Moralis.Auth.requestMessage({
      address,
      chain,
      network, domain: process.env.APP_NAME || 'mydapp.com', statement: 'Please sign this message to authenticate.',
    });
    res.json({ message });
  } catch (err) {
    res.status(500).send(err.message);
  }
});` 

This calls `Moralis.Auth.requestMessage` to generate a nonce message. The client will sign this message with MetaMask (web or mobile) to prove ownership of the wallet.

### b. Verify signature & issue Supabase JWT

This endpoint takes the signed message and signature, verifies via Moralis, then finds/creates a Supabase user row and issues a JWT using the Supabase secret. Example:

`import { createClient } from  '@supabase/supabase-js'; import jwt from  'jsonwebtoken'; const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
); // Verify endpoint app.post('/api/verify', async (req, res) => { const { message, signature } = req.body; if (!message || !signature) return res.status(400).send("Missing data"); try { // 1) Verify signature with Moralis  const { address } = (await  Moralis.Auth.verify({ message, signature })).raw; // 2) Find or create the user in Supabase  let { data, error } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('moralis_provider_id', address)
      .single(); if (error && error.code === 'PGRST116') { // not found, insert new user  const insert = await supabaseAdmin
        .from('users')
        .insert({ moralis_provider_id: address });
      data = insert.data![0];
    } const userId = data.id; // 3) Sign a JWT with Supabase secret  const token = jwt.sign({ id: userId }, process.env.SUPABASE_JWT!, { expiresIn: '1h' }); // 4) Return JWT and user info if desired res.json({ accessToken: token, user: { id: userId, address } });
  } catch (err) {
    res.status(500).send(err.message);
  }
});` 

-   **Moralis verify:** We call `Moralis.Auth.verify({ message, signature })`. If valid, it returns the wallet address (Moralis docs demonstrate exactly this pattern[developers.moralis.com](https://developers.moralis.com/supabase-authentication-how-to-authenticate-users-on-supabase/#:~:text=Request%20message%3A)).
    
-   **Supabase user:** We use `supabase-js` on the backend (with service key) to upsert a user row keyed by the wallet address. If none exists, insert one.
    
-   **JWT signing:** We use the Supabase project’s JWT secret (`SUPABASE_JWT_SECRET`). Signing a token with payload `{ id: userId }` means the token’s `id` claim identifies the user. Then Supabase will treat that token as a session for `userId`. (Supabase docs note that the service’s `jwt_secret` must be used to sign any custom user tokens[supabase.com](https://supabase.com/docs/guides/auth/jwts#:~:text=2.%20,or%20permissions%20specific%20to%20them)[github.com](https://github.com/supabase/supabase-flutter/issues/479#:~:text=1,or%20in%20column%20default%20values).)
    
-   **Response:** Return the signed token (`accessToken`) to the client. In Moralis’s blog, this step “creates a JWT to verify if a user exists. If the user is nonexistent, we create a new one and add it to the Supabase database.”[developers.moralis.com](https://developers.moralis.com/supabase-authentication-how-to-authenticate-users-on-supabase/#:~:text=Once%20you%20sign%20the%20message%2C,it%20to%20the%20Supabase%20database).
    

> **Session note:** Moralis v2 provides only the authentication endpoints; you must handle sessions yourself[forum.moralis.io](https://forum.moralis.io/t/supabase-reactjs-authentication/23545#:~:text=Hey%20%40blockchaindeveloper%2C). In our case, the “session” is simply the Supabase JWT we created. The client must store and use this token for authenticated calls.

## 4. Frontend (Expo React Native + TypeScript)

Install and configure React Native/Ethers/Moralis. In your app’s code:

`import { createClient } from  '@supabase/supabase-js'; import { useWalletConnect } from  '@walletconnect/react-native-dapp'; import { ethers } from  'ethers'; const  API_URL = 'https://your-server.com'; // Backend URL  // Initialize Supabase client (we’ll set auth later)  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLIC_ANON_KEY!);` 

We handle web and mobile slightly differently for connecting MetaMask.

### a. Web (MetaMask extension)

``// Triggered by a “Login with MetaMask” button  async  function  loginWithMetaMask() { if (!(window  as  any).ethereum) { alert("Install MetaMask"); return;
  } const provider = new ethers.providers.Web3Provider((window  as  any).ethereum); await provider.send("eth_requestAccounts", []); // Ask to connect  const signer = provider.getSigner(); const address = await signer.getAddress(); // 1) Request challenge message from backend  const { message } = await  fetch(`${API_URL}/api/request-message`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, chain: '0x1', network: 'evm' })
  }).then(res => res.json()); // 2) Ask user to sign it  const signature = await signer.signMessage(message); // 3) Verify signature on backend and get Supabase JWT  const { accessToken } = await  fetch(`${API_URL}/api/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, signature })
  }).then(res => res.json()); // 4) Set Supabase auth to this custom token  const { user, error } = await supabase.auth.setAuth(accessToken); if (error) throw error; console.log('Logged in user:', user);
}`` 

This code:

-   Connects to MetaMask (`eth_requestAccounts`) and gets the signer.
    
-   Calls our `/request-message` API with the wallet address.
    
-   Uses MetaMask to sign the returned message.
    
-   Calls `/verify`, which returns a Supabase JWT.
    
-   Calls `supabase.auth.setAuth(accessToken)` to authenticate the Supabase client as that user[supabase.com](https://supabase.com/docs/reference/javascript/v1/auth-setauth#:~:text=function%20apiFunction%28req%2C%20res%29%20,Auth)[github.com](https://github.com/supabase/supabase-flutter/issues/479#:~:text=1,or%20in%20column%20default%20values).
    

### b. Mobile (WalletConnect to MetaMask app)

On mobile, `window.ethereum` is not available. Instead use WalletConnect’s React Native SDK:

``import { useWalletConnect } from  '@walletconnect/react-native-dapp'; import  AsyncStorage  from  '@react-native-async-storage/async-storage'; import * as  Linking  from  'expo-linking'; function  WalletConnectLogin() { const connector = useWalletConnect(); async  function  loginWithWalletConnect() { // Ensure a connection is established  if (!connector.connected) { await connector.connect(); // Opens the MetaMask app via deep link } const address = connector.accounts[0]; // 1) Get challenge message from backend  const { message } = await  fetch(`${API_URL}/api/request-message`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, chain: '0x1', network: 'evm' })
    }).then(res => res.json()); // 2) Sign with WalletConnect  const signature = await connector.signPersonalMessage([message, address]); // 3) Verify on backend and get JWT  const { accessToken } = await  fetch(`${API_URL}/api/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, signature })
    }).then(res => res.json()); // 4) Use Supabase with this token  const { user, error } = await supabase.auth.setAuth(accessToken); if (error) throw error; console.log('Logged in via WalletConnect:', user);
  } return  <Button  title="Connect MetaMask"  onPress={loginWithWalletConnect} />;
}`` 

**Notes:**

-   We use `@walletconnect/react-native-dapp` and `ethers`. The `signPersonalMessage` API sends a signed message from the mobile wallet.
    
-   WalletConnect integration is supported by Moralis Auth API[developers.moralis.com](https://developers.moralis.com/walletconnect-integration-how-to-integrate-walletconnect/#:~:text=Web3%20authentication%20is%20the%20gateway,or%20combine%20it%20with%20other). The Moralis team explicitly recommends WalletConnect for mobile dApps.
    
-   Once we receive the Supabase JWT, we again call `supabase.auth.setAuth(token)`[supabase.com](https://supabase.com/docs/reference/javascript/v1/auth-setauth#:~:text=function%20apiFunction%28req%2C%20res%29%20,Auth)[github.com](https://github.com/supabase/supabase-flutter/issues/479#:~:text=1,or%20in%20column%20default%20values). This tells Supabase to treat future database calls as the logged-in user.
    

> **Mobile Linking:** For Expo, you may need to configure `Linking.makeUrl` or deep links so that when `connector.connect()` is called, it opens MetaMask with the WalletConnect session. Check WalletConnect docs for linking details.

### c. Session Persistence

After login, you should save the `accessToken` (e.g. in `AsyncStorage` or state) so the user remains signed in. On app launch, check if a valid token exists and call `supabase.auth.setAuth(token)` again to restore the session. (Since we used a 1-hour expiration above, you may implement token refresh by re-signing if needed.)

> **Supabase Session:** Supabase considers the custom JWT we provided as the session token. By calling `supabase.auth.setAuth(token)`, all subsequent `.from('users')` or other supabase calls automatically include `Authorization: Bearer <token>`[supabase.com](https://supabase.com/docs/reference/javascript/v1/auth-setauth#:~:text=function%20apiFunction%28req%2C%20res%29%20,Auth). Internally, Supabase checks this against `supabase_config.jwt_secret`. As noted in Supabase’s guidance, this is how you let a user “sign in with a custom token”[github.com](https://github.com/supabase/supabase-flutter/issues/479#:~:text=1,or%20in%20column%20default%20values).

## 5. Managing User Profile Metadata

We have a `users` table with a JSON `metadata` field. You can allow users to store additional info (username, avatar URL, stats, etc.) there. For example, after login you might display a profile screen:

`// Assume currentUser.id is the row ID stored in JWT  const { data, error } = await supabase
  .from('users')
  .select('metadata')
  .eq('id', currentUser.id)
  .single(); setProfileData(data?.metadata); // To update profile:  const newMeta = { username: 'Alice', avatar: 'https://..img.png', stats: { wins: 0, losses: 0 } }; await supabase
  .from('users')
  .update({ metadata: newMeta })
  .eq('id', currentUser.id);` 

Because of the RLS policy we set up, each authenticated user can only read/update their own `users` row. (The JWT’s `id` must match the `id` column, as enforced by the policy[moralisweb3.github.io](https://moralisweb3.github.io/Moralis-JS-SDK/demos/supabase-auth/#:~:text=alter%20table%20,level%20security).) You can structure `metadata` as JSON, or add dedicated columns (e.g. `username text`) if preferred.

> **Supabase Storage:** For uploading avatars, consider using Supabase Storage (with signed URLs) and storing the file URL in the `metadata.avatar` field. Supabase’s Auth and Storage docs have examples, or simply upload via the Supabase client.

## 6. Notes & Best Practices

-   **Moralis Free Tier:** Moralis Starter Plan allows 25 RPS and ~10M calls/month[forum.moralis.io](https://forum.moralis.io/t/free-and-pro-tier-limits/8932#:~:text=Free%20and%20pro%20tier%20limits,both%20node%20and%20API%20calls), which is ample for authentication use. All Moralis Auth endpoints are available on free tier.
    
-   **Supabase API keys:** Never expose `SUPABASE_SERVICE_KEY` or JWT secret on the client. They stay in the backend. Only the anon/public key is used by the app (and only to create the client – the `Authorization` header drives permissions).
    
-   **Token Refresh:** We signed a JWT with a fixed lifetime (e.g. 1 hour). You can handle expiration by simply having the user re-authenticate (re-sign with wallet) when the token expires. Supabase does not provide refresh tokens for custom JWT.
    
-   **Error Handling:** Ensure to catch and display errors (e.g. if signature invalid). In development, the Moralis response `{ verified: false }` means the signature wasn’t valid.
    
-   **Testing:** Use Sepolia or another testnet by changing `chain` and network (e.g. `chain: '0xaa36a7'` for Sepolia) in both Moralis request and MetaMask settings. Moralis Auth works on testnets too.
    
-   **References:** This setup is based on Moralis’s Supabase integration docs and demos[developers.moralis.com](https://developers.moralis.com/supabase-authentication-how-to-authenticate-users-on-supabase/#:~:text=The%20Web3%20authentication%20flow%20is,and%20adds%20it%20to%20Supabase)[developers.moralis.com](https://developers.moralis.com/supabase-authentication-how-to-authenticate-users-on-supabase/#:~:text=Once%20you%20sign%20the%20message%2C,it%20to%20the%20Supabase%20database). For example, their tutorial shows essentially the same flow: Web3 login → create JWT → create user in Supabase if new[developers.moralis.com](https://developers.moralis.com/supabase-authentication-how-to-authenticate-users-on-supabase/#:~:text=The%20Web3%20authentication%20flow%20is,and%20adds%20it%20to%20Supabase)[developers.moralis.com](https://developers.moralis.com/supabase-authentication-how-to-authenticate-users-on-supabase/#:~:text=Once%20you%20sign%20the%20message%2C,it%20to%20the%20Supabase%20database). WalletConnect integration is covered in Moralis’s docs as the recommended mobile method[developers.moralis.com](https://developers.moralis.com/walletconnect-integration-how-to-integrate-walletconnect/#:~:text=Web3%20authentication%20is%20the%20gateway,or%20combine%20it%20with%20other)[forum.moralis.io](https://forum.moralis.io/t/authentication-flow-for-mobile-app/23795#:~:text=I%20have%20client%20app%20on,wagmi%20that%20is%20not%20working). For Supabase, see the official docs on JWTs and custom auth strategies[supabase.com](https://supabase.com/docs/guides/auth/jwts#:~:text=2.%20,or%20permissions%20specific%20to%20them)[github.com](https://github.com/supabase/supabase-flutter/issues/479#:~:text=1,or%20in%20column%20default%20values).
    

## 7. Useful Links

-   **Moralis Auth API:** Moralis Documentation – Authentication API (covers `requestMessage`, `verify`, etc.).
    
-   **Moralis Supabase Demo:** The official Moralis-JS-SDK repo has a supabase-auth demo and docs[moralisweb3.github.io](https://moralisweb3.github.io/Moralis-JS-SDK/demos/supabase-auth/#:~:text=,run%20the%20following%20SQL%20query)[moralisweb3.github.io](https://moralisweb3.github.io/Moralis-JS-SDK/demos/supabase-auth/#:~:text=alter%20table%20,level%20security)[developers.moralis.com](https://developers.moralis.com/supabase-authentication-how-to-authenticate-users-on-supabase/#:~:text=Request%20message%3A).
    
-   **Supabase Docs:** JWT auth guide and PostgREST tutorial for using `supabase-js`.
    
-   **WalletConnect:** WalletConnect Docs for mobile linking and usage in React Native.
    
-   **Moralis Forum:** Troubleshooting and examples (e.g. React Native & WalletConnect discussion[forum.moralis.io](https://forum.moralis.io/t/authentication-flow-for-mobile-app/23795#:~:text=I%20have%20client%20app%20on,wagmi%20that%20is%20not%20working)).
    

By following these steps, you enable MetaMask-only login in your Expo app, with Moralis handling the Web3 authentication and Supabase managing the session and user data. The user experience is seamless: tap “Connect Wallet,” sign the message, and you’re logged in – with all profile info stored securely in Supabase.

Citações

[](https://developers.moralis.com/supabase-authentication-how-to-authenticate-users-on-supabase/#:~:text=Request%20message%3A)

![Favicon](https://www.google.com/s2/favicons?domain=https://developers.moralis.com&sz=32)

Supabase Authentication - How to Authenticate Users on Supabase

https://developers.moralis.com/supabase-authentication-how-to-authenticate-users-on-supabase/

[](https://developers.moralis.com/supabase-authentication-how-to-authenticate-users-on-supabase/#:~:text=The%20Web3%20authentication%20flow%20is,and%20adds%20it%20to%20Supabase)

![Favicon](https://www.google.com/s2/favicons?domain=https://developers.moralis.com&sz=32)

Supabase Authentication - How to Authenticate Users on Supabase

https://developers.moralis.com/supabase-authentication-how-to-authenticate-users-on-supabase/

[](https://forum.moralis.io/t/free-and-pro-tier-limits/8932#:~:text=Free%20and%20pro%20tier%20limits,both%20node%20and%20API%20calls)

![Favicon](https://www.google.com/s2/favicons?domain=https://forum.moralis.io&sz=32)

Free and pro tier limits - Moralis Forum

https://forum.moralis.io/t/free-and-pro-tier-limits/8932

[](https://moralisweb3.github.io/Moralis-JS-SDK/demos/supabase-auth/#:~:text=create%20table%20public,id%29%20%29%20tablespace%20pg_default)

[](https://moralisweb3.github.io/Moralis-JS-SDK/demos/supabase-auth/#:~:text=create%20table%20public,id%29%20%29%20tablespace%20pg_default)

supabase-auth | Moralis SDK (JavaSDKScript / TypeScript)

https://moralisweb3.github.io/Moralis-JS-SDK/demos/supabase-auth/

[](https://moralisweb3.github.io/Moralis-JS-SDK/demos/supabase-auth/#:~:text=alter%20table%20,level%20security)

[](https://moralisweb3.github.io/Moralis-JS-SDK/demos/supabase-auth/#:~:text=alter%20table%20,level%20security)

supabase-auth | Moralis SDK (JavaSDKScript / TypeScript)

https://moralisweb3.github.io/Moralis-JS-SDK/demos/supabase-auth/

[](https://developers.moralis.com/supabase-authentication-how-to-authenticate-users-on-supabase/#:~:text=SUPABASE_PUBLIC_ANON_KEY%20%3D%20%27%27)

![Favicon](https://www.google.com/s2/favicons?domain=https://developers.moralis.com&sz=32)

Supabase Authentication - How to Authenticate Users on Supabase

https://developers.moralis.com/supabase-authentication-how-to-authenticate-users-on-supabase/

[](https://supabase.com/docs/guides/auth/jwts#:~:text=2.%20,or%20permissions%20specific%20to%20them)

![Favicon](https://www.google.com/s2/favicons?domain=https://supabase.com&sz=32)

JWTs | Supabase Docs

https://supabase.com/docs/guides/auth/jwts

[](https://github.com/supabase/supabase-flutter/issues/479#:~:text=1,or%20in%20column%20default%20values)

![Favicon](https://www.google.com/s2/favicons?domain=https://github.com&sz=32)

Sign in with Custom (third party) JWT · Issue #479 · supabase/supabase-flutter · GitHub

https://github.com/supabase/supabase-flutter/issues/479

[](https://developers.moralis.com/supabase-authentication-how-to-authenticate-users-on-supabase/#:~:text=Once%20you%20sign%20the%20message%2C,it%20to%20the%20Supabase%20database)

![Favicon](https://www.google.com/s2/favicons?domain=https://developers.moralis.com&sz=32)

Supabase Authentication - How to Authenticate Users on Supabase

https://developers.moralis.com/supabase-authentication-how-to-authenticate-users-on-supabase/

[](https://forum.moralis.io/t/supabase-reactjs-authentication/23545#:~:text=Hey%20%40blockchaindeveloper%2C)

![Favicon](https://www.google.com/s2/favicons?domain=https://forum.moralis.io&sz=32)

Supabase & ReactJS - Authentication - Moralis General - Moralis Web3 Forum - Largest Web3 Dev Community

https://forum.moralis.io/t/supabase-reactjs-authentication/23545

[](https://supabase.com/docs/reference/javascript/v1/auth-setauth#:~:text=function%20apiFunction%28req%2C%20res%29%20,Auth)

![Favicon](https://www.google.com/s2/favicons?domain=https://supabase.com&sz=32)

JavaScript: Update the access token | Supabase Docs

https://supabase.com/docs/reference/javascript/v1/auth-setauth

[](https://developers.moralis.com/walletconnect-integration-how-to-integrate-walletconnect/#:~:text=Web3%20authentication%20is%20the%20gateway,or%20combine%20it%20with%20other)

![Favicon](https://www.google.com/s2/favicons?domain=https://developers.moralis.com&sz=32)

WalletConnect Integration - How to Integrate WalletConnect

https://developers.moralis.com/walletconnect-integration-how-to-integrate-walletconnect/

[](https://forum.moralis.io/t/authentication-flow-for-mobile-app/23795#:~:text=I%20have%20client%20app%20on,wagmi%20that%20is%20not%20working)

![Favicon](https://www.google.com/s2/favicons?domain=https://forum.moralis.io&sz=32)

Authentication flow for mobile app - Moralis General - Moralis Web3 Forum - Largest Web3 Dev Community

https://forum.moralis.io/t/authentication-flow-for-mobile-app/23795

[](https://moralisweb3.github.io/Moralis-JS-SDK/demos/supabase-auth/#:~:text=,run%20the%20following%20SQL%20query)

[](https://moralisweb3.github.io/Moralis-JS-SDK/demos/supabase-auth/#:~:text=,run%20the%20following%20SQL%20query)

supabase-auth | Moralis SDK (JavaSDKScript / TypeScript)

https://moralisweb3.github.io/Moralis-JS-SDK/demos/supabase-auth/

Todas as fontes

[](https://developers.moralis.com/supabase-authentication-how-to-authenticate-users-on-supabase/#:~:text=Request%20message%3A)

![Favicon](https://www.google.com/s2/favicons?domain=https://developers.moralis.com&sz=32)

developers.moralis

[](https://forum.moralis.io/t/free-and-pro-tier-limits/8932#:~:text=Free%20and%20pro%20tier%20limits,both%20node%20and%20API%20calls)

![Favicon](https://www.google.com/s2/favicons?domain=https://forum.moralis.io&sz=32)

forum.moralis

[](https://moralisweb3.github.io/Moralis-JS-SDK/demos/supabase-auth/#:~:text=create%20table%20public,id%29%20%29%20tablespace%20pg_default)

[](https://moralisweb3.github.io/Moralis-JS-SDK/demos/supabase-auth/#:~:text=create%20table%20public,id%29%20%29%20tablespace%20pg_default)

moralisweb3.github

[](https://supabase.com/docs/guides/auth/jwts#:~:text=2.%20,or%20permissions%20specific%20to%20them)

![Favicon](https://www.google.com/s2/favicons?domain=https://supabase.com&sz=32)

supabase

[](https://github.com/supabase/supabase-flutter/issues/479#:~:text=1,or%20in%20column%20default%20values)

![Favicon](https://www.google.com/s2/favicons?domain=https://github.com&sz=32)

github
