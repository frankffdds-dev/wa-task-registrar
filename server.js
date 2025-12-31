const express = require('express');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());

// Your fixed credentials
const PASSWORD = 'f11111';
const INVITE_CODE = 'YSQCYDOX';
const CLIENT_ID = 'cede439cad3fd859a3ef41ac8ac4eb3c';

async function registerNumber(phone) {
  // Ensure full international format (you can adjust prefix as needed)
  const fullPhone = phone.startsWith('31') ? phone : '31' + phone;

  // Launch real Chromium in the cloud
  const browser = await chromium.launch({ headless: true });
  let token = null;

  try {
    const page = await browser.newPage();
    // Go to register page
    await page.goto('https://wa-task.com/pages/register/register', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    // Wait for Turnstile to auto-solve (invisible mode)
    await page.waitForTimeout(10000);

    // Extract token from browser
    token = await page.evaluate(() => {
      if (window.turnstile?.getResponse) return window.turnstile.getResponse();
      const el = document.querySelector('input[name="cf-token"]');
      return el ? el.value : null;
    });

    await browser.close();
  } catch (e) {
    await browser.close();
    throw new Error('Browser failed: ' + e.message);
  }

  if (!token) throw new Error('Turnstile token not found');

  // Now register via API
  const res = await fetch('https://wa-task.com/api_proxy/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'clientid': CLIENT_ID,
      'origin': 'https://wa-task.com',
      'referer': 'https://wa-task.com/pages/register/register'
    },
    body: JSON.stringify({
      username: fullPhone,
      grantType: "sms",
      password: PASSWORD,
      confirmPassword: PASSWORD,
      clientId: CLIENT_ID,
      turnstileToken: token,
      inviteCode: INVITE_CODE,
      phonenumber: fullPhone,
      tenantId: "000000",
      userType: "app_user",
      nickname: fullPhone,
      channelCode: ""
    })
  });

  const data = await res.json();
  return { success: data.code === 200, message: data.msg || 'OK' };
}

// HTTP endpoint: accept phone number
app.post('/register', async (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^\d{9,15}$/.test(phone)) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }

  try {
    const result = await registerNumber(phone);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
