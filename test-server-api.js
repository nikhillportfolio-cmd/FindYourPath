const http = require('http');

process.env.PORT = '3099';
const server = require('./server.js');

function fetch(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: 3099,
            path: path,
            method: method,
            headers: body ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(JSON.stringify(body))
            } : {}
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch(e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runTests() {
    // Wait for server to listen
    await new Promise(r => setTimeout(r, 1500));

    console.log('Testing GET /api/compass/domains...');
    const domRes = await fetch('/api/compass/domains');
    console.log('Status:', domRes.status, 'Domains count:', domRes.body.domains?.length);
    if (domRes.status !== 200 || !domRes.body.domains || domRes.body.domains.length < 20) {
        throw new Error('Domains endpoint failed');
    }

    console.log('Testing GET /api/compass/questions...');
    const qRes = await fetch('/api/compass/questions');
    console.log('Status:', qRes.status, 'Questions count:', qRes.body.questions?.length);
    if (qRes.status !== 200 || !qRes.body.questions || qRes.body.questions.length < 10) {
        throw new Error('Questions endpoint failed');
    }

    console.log('Testing GET /api/compass/careers...');
    const cRes = await fetch('/api/compass/careers');
    console.log('Status:', cRes.status, 'Careers count:', cRes.body.careers?.length);
    if (cRes.status !== 200 || !cRes.body.careers || cRes.body.careers.length < 20) {
        throw new Error('Careers endpoint failed');
    }

    console.log('Testing POST /api/compass/evaluate...');
    const evalRes = await fetch('/api/compass/evaluate', 'POST', {
        preferenceDomain: 'TechAI',
        dimensionScores: { analyticalReasoning: 5, creativity: 4 }
    });
    console.log('Status:', evalRes.status, 'Success:', evalRes.body.success);
    if (evalRes.status !== 200 || !evalRes.body.success) {
        throw new Error('Evaluate endpoint failed');
    }

    console.log('Testing backward compatibility: GET /api/questions?interest=TechAI...');
    const legacyQ = await fetch('/api/questions?interest=TechAI');
    console.log('Status:', legacyQ.status, 'Questions count:', legacyQ.body?.length);
    if (legacyQ.status !== 200 || !Array.isArray(legacyQ.body)) {
        throw new Error('Legacy questions endpoint failed');
    }

    console.log('Testing backward compatibility: POST /api/calculate-result...');
    const legacyCalc = await fetch('/api/calculate-result', 'POST', {
        interest: 'TechAI',
        userTraits: { LogicalReasoning: 3, AnalyticalProblemSolving: 3 }
    });
    console.log('Status:', legacyCalc.status, 'Results count:', legacyCalc.body?.length);
    if (legacyCalc.status !== 200 || !Array.isArray(legacyCalc.body)) {
        throw new Error('Legacy calculate-result endpoint failed');
    }

    console.log('\n✅ ALL SERVER API ENDPOINTS VERIFIED SUCCESSFULLY!');
    process.exit(0);
}

runTests().catch(err => {
    console.error('❌ Server API Test Failed:', err);
    process.exit(1);
});
