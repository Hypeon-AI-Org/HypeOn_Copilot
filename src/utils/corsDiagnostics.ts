/**
 * CORS Diagnostics Utility
 * Helps diagnose CORS issues between frontend and backend
 */

export interface CORSDiagnosticResult {
  success: boolean;
  corsConfigured: boolean;
  message: string;
  details: {
    frontendOrigin: string;
    backendUrl: string;
    corsHeaders?: {
      'access-control-allow-origin'?: string | null;
      'access-control-allow-methods'?: string | null;
      'access-control-allow-headers'?: string | null;
    };
    error?: string;
  };
  recommendations: string[];
}

/**
 * Run comprehensive CORS diagnostics
 */
export async function diagnoseCORS(backendUrl: string): Promise<CORSDiagnosticResult> {
  const frontendOrigin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
  const recommendations: string[] = [];
  
  console.group('🔍 CORS Diagnostics');
  console.log('Frontend Origin:', frontendOrigin);
  console.log('Backend URL:', backendUrl);
  
  try {
    // Test 1: OPTIONS preflight request
    console.log('\n📡 Testing OPTIONS preflight...');
    const optionsResponse = await fetch(`${backendUrl}/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': frontendOrigin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });

    const corsHeaders = {
      'access-control-allow-origin': optionsResponse.headers.get('access-control-allow-origin'),
      'access-control-allow-methods': optionsResponse.headers.get('access-control-allow-methods'),
      'access-control-allow-headers': optionsResponse.headers.get('access-control-allow-headers'),
      'access-control-allow-credentials': optionsResponse.headers.get('access-control-allow-credentials'),
    };

    console.log('CORS Headers:', corsHeaders);

    const originAllowed = corsHeaders['access-control-allow-origin'] === '*' || 
                         corsHeaders['access-control-allow-origin'] === frontendOrigin;

    if (!originAllowed) {
      recommendations.push(
        `Backend must set: Access-Control-Allow-Origin: ${frontendOrigin}`
      );
    }

    // Test 2: Actual GET request
    console.log('\n📡 Testing GET request...');
    const getResponse = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      headers: {
        'Origin': frontendOrigin,
      },
    });

    if (!getResponse.ok) {
      recommendations.push(`Backend returned ${getResponse.status} ${getResponse.statusText}`);
    }

    const getCorsHeaders = {
      'access-control-allow-origin': getResponse.headers.get('access-control-allow-origin'),
    };

    const getOriginAllowed = getCorsHeaders['access-control-allow-origin'] === '*' || 
                            getCorsHeaders['access-control-allow-origin'] === frontendOrigin;

    console.log('GET Response CORS:', getCorsHeaders);
    console.log('GET Response Status:', getResponse.status);

    const corsConfigured = originAllowed && getOriginAllowed;
    const success = corsConfigured && getResponse.ok;

    if (!corsConfigured) {
      recommendations.push('Check backend CORS configuration');
      recommendations.push('Ensure OPTIONS requests return proper CORS headers');
    }

    console.groupEnd();

    return {
      success,
      corsConfigured,
      message: success 
        ? '✅ CORS is properly configured' 
        : '❌ CORS configuration issue detected',
      details: {
        frontendOrigin,
        backendUrl,
        corsHeaders: {
          'access-control-allow-origin': corsHeaders['access-control-allow-origin'],
          'access-control-allow-methods': corsHeaders['access-control-allow-methods'],
          'access-control-allow-headers': corsHeaders['access-control-allow-headers'],
        },
      },
      recommendations,
    };

  } catch (error: any) {
    console.error('CORS Test Error:', error);
    console.groupEnd();

    recommendations.push('Backend may not be accessible');
    recommendations.push('Check network connectivity');
    recommendations.push('Verify backend URL is correct');
    
    if (error.message.includes('Failed to fetch')) {
      recommendations.push('This is likely a CORS issue - backend must allow origin: ' + frontendOrigin);
    }

    return {
      success: false,
      corsConfigured: false,
      message: '❌ CORS test failed: ' + error.message,
      details: {
        frontendOrigin,
        backendUrl,
        error: error.message,
      },
      recommendations,
    };
  }
}

/**
 * Quick CORS test - can be called from browser console
 */
export async function quickCORSTest() {
  const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.copilot.hypeon.ai';
  const result = await diagnoseCORS(backendUrl);
  
  console.log('\n📊 CORS Diagnostic Results:');
  console.log('Success:', result.success);
  console.log('CORS Configured:', result.corsConfigured);
  console.log('Message:', result.message);
  console.log('\n📋 Recommendations:');
  result.recommendations.forEach((rec, i) => {
    console.log(`${i + 1}. ${rec}`);
  });
  
  return result;
}

// Make available globally for console testing
if (typeof window !== 'undefined') {
  (window as any).testCORS = quickCORSTest;
  console.log('💡 Run testCORS() in console to diagnose CORS issues');
}

