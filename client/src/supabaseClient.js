import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://kpymahqrjdbzbbfjiiyh.supabase.co';
export const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtweW1haHFyamRiemJiZmppaXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NDE5MzgsImV4cCI6MjA2OTAxNzkzOH0.KXJS5rdOQ_Cwhxd7CtD8Br2ZFHslqTBmSLvAdj8zthk';

export const supabase = createClient(supabaseUrl, supabaseKey);
