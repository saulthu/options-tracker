'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface DebugInfo {
  env: { url: string; key: string };
  auth: { user: string | undefined; error: unknown };
  testQuery: { data: unknown; error: unknown };
  userQuery?: { data: unknown; error: unknown };
  tableExists: { data: unknown; error: unknown };
  usersTable: { data: unknown; error: unknown };
  userInsertTest?: { data: unknown; error: unknown };
  catchError?: unknown;
}

export default function DebugSupabase() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const runDebug = async () => {
    setLoading(true);
    const info: DebugInfo = {
      env: { url: '', key: '' },
      auth: { user: undefined, error: null },
      testQuery: { data: null, error: null },
      tableExists: { data: null, error: null },
      usersTable: { data: null, error: null }
    };

    try {
      // Check environment variables
      info.env = {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Present' : 'Missing',
        key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Present' : 'Missing'
      };

      // Check auth
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      info.auth = { user: user?.id, error: authError };

      // Test simple query
      const { data: testData, error: testError } = await supabase
        .from('transactions')
        .select('count')
        .limit(1);
      info.testQuery = { data: testData, error: testError };

      // Test with user filter
      if (user) {
        const { data: userData, error: userError } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .limit(1);
        info.userQuery = { data: userData, error: userError };
      }

      // Test table existence
      const { data: tableData, error: tableError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'transactions');
      info.tableExists = { data: tableData, error: tableError };

      // Test users table access
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email')
        .limit(1);
      info.usersTable = { data: usersData, error: usersError };

      // Test user insertion (if user exists)
      if (user) {
        const { data: insertTestData, error: insertTestError } = await supabase
          .from('users')
          .insert({
            id: user.id + '_test',
            email: 'test@example.com',
            name: 'Test User'
          })
          .select();
        info.userInsertTest = { data: insertTestData, error: insertTestError };
      }

    } catch (err) {
      info.catchError = err;
    }

    setDebugInfo(info);
    setLoading(false);
  };

  return (
    <div className="p-4 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg">
      <h3 className="text-white text-lg mb-4">Supabase Debug Info</h3>
      <button
        onClick={runDebug}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Running...' : 'Run Debug'}
      </button>
      
      {debugInfo && (
        <pre className="mt-4 p-4 bg-[#0f0f0f] text-green-400 text-xs overflow-auto max-h-96">
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      )}
    </div>
  );
}
