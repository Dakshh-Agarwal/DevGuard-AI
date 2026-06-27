import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://dzznwbvxogstsvllokzm.supabase.co';
export const supabaseKey = 'sb_publishable_WWAk8tXRG8b0WGtBN04zSA_vjXIuXds';

export const supabase = createClient(supabaseUrl, supabaseKey);
