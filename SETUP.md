# Options Tracker Setup Guide

## Database Setup (Supabase)

### 1. Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Create a new project
3. Wait for the project to be ready

### 2. Get Your Project Credentials
1. Go to Project Settings > API
2. Copy the following values:
   - Project URL
   - Anon (public) key

### 3. Set Environment Variables
1. Create a `.env.local` file in your project root
2. Add the following variables:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### 4. Run Database Schema
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `database-schema.sql`
4. Run the SQL script

## Features Implemented

### Authentication
- ✅ User signup/signin with email/password
- ✅ Protected routes (dashboard only visible when authenticated)
- ✅ Automatic user profile creation on signup
- ✅ Sign out functionality

### Database Structure
- ✅ Users table (extends Supabase auth)
- ✅ Positions table (options trades)
- ✅ PnL History table (performance tracking)
- ✅ Row Level Security (RLS) policies
- ✅ Automatic timestamps and user isolation

### UI Components
- ✅ Login/Signup form with dark theme
- ✅ Protected dashboard with sidebar
- ✅ User email display in header
- ✅ Sign out button

## Testing the Setup

### 1. Start the Development Server
```bash
npm run dev
```

### 2. Test Authentication Flow
1. Visit the app - you should see the login form
2. Click "Don't have an account? Sign Up"
3. Create a new account with email/password
4. You should be redirected to the dashboard
5. Test the sign out functionality

### 3. Verify Database
1. Go to your Supabase dashboard
2. Check the Tables section - you should see:
   - `users` table with your new user
   - `positions` table (empty initially)
   - `pnl_history` table (empty initially)

## Next Steps

Once this basic setup is working, we can implement:

1. **Data Persistence**: Save positions to database instead of local state
2. **Real-time Updates**: Use Supabase subscriptions for live data
3. **Position Management**: CRUD operations for options positions
4. **P&L Tracking**: Automatic calculation and storage of performance data
5. **User Settings**: Profile management and preferences

## Troubleshooting

### Common Issues

1. **Environment Variables Not Loading**
   - Restart your dev server after adding `.env.local`
   - Ensure variable names start with `NEXT_PUBLIC_`

2. **Database Connection Errors**
   - Verify your Supabase URL and key are correct
   - Check that your project is active and not paused

3. **Authentication Not Working**
   - Ensure the database schema has been run
   - Check browser console for errors
   - Verify RLS policies are active

4. **TypeScript Errors**
   - Run `npm install` to ensure all dependencies are installed
   - Check that `@supabase/supabase-js` is properly installed
