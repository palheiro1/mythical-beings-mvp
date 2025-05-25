-- Ensure profiles table has the necessary RLS policies
-- Add policy to allow authenticated users to create their own profiles
CREATE POLICY "Users can create their own profile" ON profiles
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

-- Add policy to allow users to update their own profiles
CREATE POLICY "Users can update their own profile" ON profiles
FOR UPDATE 
TO authenticated
USING (auth.uid() = id);
