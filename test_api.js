const https = require('https');

https.get('https://sjc.com.vn/xml/tygiavang.xml', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('SJC XML Snippet:', data.substring(0, 500)));
}).on('error', err => console.log('SJC Error:', err.message));
