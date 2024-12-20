import { logger } from './utils/logger.js';
import fetch from 'node-fetch';
import fs from 'fs';

const readAccounts = (filePath) => {
    const accounts = [];
    const data = fs.readFileSync(filePath, 'utf-8');

    data.split('\n').forEach((line) => {
        const [email, password] = line.trim().split(':');
        if (email && password) {
            accounts.push({ email, password });
        }
    });

    return accounts;
};

const loginUser = async (email, password) => {
    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const loginPayload = { username: email, password };
            const loginResponse = await fetch('https://api.openloop.so/users/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(loginPayload),
            });

            if (!loginResponse.ok) {
                throw new Error(`Login failed! Status: ${loginResponse.status}`);
            }

            const loginData = await loginResponse.json();
            const accessToken = loginData.data.accessToken;
            logger('Login successful get Token:', 'success', accessToken);

            fs.writeFileSync('token.txt', accessToken + '\n', 'utf8');
            logger('Access token saved to token.txt');
            return;
        } catch (error) {
            attempt++;
            logger(`Login attempt ${attempt} failed for email: ${email}. Error: ${error.message}`, 'error');

            if (attempt >= maxRetries) {
                logger(`Max retries reached for login. Aborting...`, 'error');
                return;
            }

            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
};

const registerUser = async (email, password) => {
    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const inviteCode = 'olc853b12a';
            const registrationPayload = { name: email, username: email, password, inviteCode };

            const registerResponse = await fetch('https://api.openloop.so/users/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registrationPayload),
            });

            if (registerResponse.status === 401) {
                logger('Email already exists. Attempting to login...');
                await loginUser(email, password);
                return;
            }

            if (!registerResponse.ok) {
                throw new Error(`Registration failed! Status: ${registerResponse.status}`);
            }

            const registerData = await registerResponse.json();
            logger('Registration successful:', 'success', registerData.message);

            await loginUser(email, password);
            return;
        } catch (error) {
            attempt++;
            logger(`Attempt ${attempt} failed. Error: ${error.message}`, 'error');

            if (attempt >= maxRetries) {
                logger('Max retries reached for registration/login. Aborting...', 'error');
                return;
            }

            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
};

const processAccounts = async () => {
    const filePath = './account.txt'; // Path to the accounts file
    if (!fs.existsSync(filePath)) {
        logger('Accounts file not found. Please create account.txt with format email:password', 'error');
        return;
    }

    const accounts = readAccounts(filePath);
    if (accounts.length === 0) {
        logger('No accounts found in account.txt', 'error');
        return;
    }

    for (const { email, password } of accounts) {
        logger(`Processing account: ${email}`);
        await registerUser(email, password);
    }
};

processAccounts();
