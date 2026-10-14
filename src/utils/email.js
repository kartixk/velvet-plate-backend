const nodemailer = require('nodemailer');
const { Resend } = require('resend');

// ─── RESEND CLIENT ──────────────────────────────────────────────────────────
const getResendClient = () => {
    const apiKey = (process.env.RESEND_API_KEY || '').trim();
    if (apiKey && !apiKey.startsWith('your_resend_api_key')) {
        return new Resend(apiKey);
    }
    return null;
};

// ─── FALLBACK SMTP TRANSPORTER ───────────────────────────────────────────────
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '465'),
        secure: true,          // true for port 465 (SSL)
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
        tls: {
            rejectUnauthorized: false,  // avoids self-signed cert errors in dev
        }
    });
};

const getSender = () => {
    if (process.env.RESEND_FROM) {
        return process.env.RESEND_FROM;
    }
    if (process.env.EMAIL_USER) {
        return `"Velvet Plate" <${process.env.EMAIL_USER}>`;
    }
    return 'Velvet Plate <onboarding@resend.dev>';
};

// ─── CONNECTION / CONFIG CHECK ON STARTUP ────────────────────────────────────
const verifyEmailConfig = async () => {
    const resend = getResendClient();
    if (resend) {
        console.log('✅ Email service: Resend API active');
        return;
    }

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        try {
            const transporter = createTransporter();
            await transporter.verify();
            console.log('✅ Email service: SMTP connection verified');
        } catch (err) {
            console.warn('⚠️  Email SMTP connection failed:', err.message);
        }
    } else {
        console.log('ℹ️  Email service: Set RESEND_API_KEY in .env to enable outgoing email notifications.');
    }
};

// Only run startup verification when not running tests
if (process.env.NODE_ENV !== 'test') {
    verifyEmailConfig();
}

// ─── SEND HELPERS ────────────────────────────────────────────────────────────

/**
 * Generic send wrapper — logs and swallows errors so email issues
 * never crash the main request flow.
 */
const sendMail = async (options) => {
    try {
        const sender = getSender();
        const resend = getResendClient();

        if (resend) {
            const { data, error } = await resend.emails.send({
                from: sender,
                to: options.to,
                subject: options.subject,
                html: options.html,
            });

            if (error) {
                console.error(`❌ Resend failed to send email to ${options.to}:`, error.message || error);
                return null;
            }
            return data;
        }

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const transporter = createTransporter();
            const info = await transporter.sendMail({ from: sender, ...options });
            return info;
        }

        console.warn(`⚠️  Email skipped for ${options.to}: RESEND_API_KEY is not configured.`);
        return null;
    } catch (err) {
        console.error(`❌ Failed to send email to ${options.to}:`, err.message);
        return null;
    }
};

// ─── EMAIL TEMPLATES ─────────────────────────────────────────────────────────

/**
 * Sent when manager account is verified.
 */
const sendManagerAccountVerifiedEmail = async (userEmail, userName) => {
    await sendMail({
        to: userEmail,
        subject: '✔ Your Velvet Plate Manager Account is Verified',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #0f172a;">
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 56px; height: 56px; border-radius: 14px; background: #FF5A00; color: #fff; font-size: 28px; font-weight: 900; line-height: 56px;">V</div>
            </div>
            <h1 style="text-align: center; font-size: 22px; font-weight: 800; margin-bottom: 12px;">Account Verified</h1>
            <p style="text-align: center; color: #475569; font-size: 15px; line-height: 1.6;">
                Hello <strong>${userName}</strong>,<br><br>
                Your manager account has been verified. You can now log in to the Velvet Plate Partner Dashboard and complete your store onboarding.
            </p>
            <div style="text-align: center; margin: 28px 0;">
                <a href="http://localhost:5173/login" style="display: inline-block; padding: 13px 28px; background: #FF5A00; color: #fff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px;">
                    Go to Dashboard →
                </a>
            </div>
            <p style="text-align: center; color: #94a3b8; font-size: 12px;">— Velvet Plate Team</p>
        </div>
        `
    });
};

/**
 * Sent to manager immediately after signup.
 */
const sendManagerWelcomeEmail = async (userEmail, userName) => {
    await sendMail({
        to: userEmail,
        subject: '🚀 Welcome to Velvet Plate — Let\'s Get Started!',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #0f172a; border-radius: 20px; border: 1px solid #f1f5f9;">
            <h1 style="font-size: 22px; font-weight: 800; margin-bottom: 12px;">Welcome, Partner!</h1>
            <p style="color: #475569; font-size: 15px; line-height: 1.6;">
                Hi <strong>${userName}</strong>,<br><br>
                Thank you for joining Velvet Plate. Your account is currently <strong>pending admin approval</strong>.<br><br>
                Once an administrator reviews your profile, you will receive a verification email. In the meantime, feel free to explore the partner portal and prepare your store documentation.
            </p>
            <div style="text-align: center; margin: 24px 0;">
                <a href="http://localhost:5173/manager/onboarding" style="display: inline-block; padding: 12px 24px; background: #0f172a; color: #fff; text-decoration: none; border-radius: 10px; font-weight: 700;">
                    Begin Onboarding →
                </a>
            </div>
        </div>
        `
    });
};

/**
 * Sent to customer after signup.
 */
const sendWelcomeEmail = async (userEmail, userName) => {
    await sendMail({
        to: userEmail,
        subject: '🍕 Welcome to Velvet Plate!',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #0f172a;">
            <h1 style="font-size: 24px; font-weight: 900; color: #FF5A00;">Welcome to the Family!</h1>
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-top: 20px;">
                Hi <strong>${userName}</strong>, we're thrilled to have you here. Velvet Plate is your home for the best local flavors, delivered fast or ready for pickup.
            </p>
            <div style="text-align: center; margin: 32px 0;">
                <a href="http://localhost:5173/products" style="display: inline-block; padding: 14px 28px; background: #FF5A00; color: #fff; text-decoration: none; border-radius: 12px; font-weight: 800;">
                    Explore Menu →
                </a>
            </div>
            <p style="text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                Join the conversation on Instagram @VelvetPlate
            </p>
        </div>
        `
    });
};

/**
 * Sent when admin approves a store (storeStatus → verified).
 */
const sendStoreVerifiedEmail = async (managerEmail, managerName, storeName) => {
    await sendMail({
        to: managerEmail,
        subject: `🎉 Your Store "${storeName}" Has Been Verified!`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #0f172a;">
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; font-size: 48px;">🎉</div>
            </div>
            <h1 style="text-align: center; font-size: 22px; font-weight: 800; margin-bottom: 12px;">Congratulations, ${managerName}!</h1>
            <p style="text-align: center; color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
                Your store <strong>"${storeName}"</strong> has been verified by the Velvet Plate team.<br>
                You can now start accepting orders from the Partner Dashboard.
            </p>
            <div style="text-align: center; margin: 28px 0;">
                <a href="http://localhost:5173/manager/dashboard" style="display: inline-block; padding: 13px 28px; background: #FF5A00; color: #fff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px;">
                    Open Dashboard →
                </a>
            </div>
            <p style="text-align: center; color: #94a3b8; font-size: 12px;">— Velvet Plate Partner Team</p>
        </div>
        `
    });
};

/**
 * Sent whenever a store's status changes (under_review / rejected / etc.)
 */
const escapeHtml = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// `reason` is optional and only used for rejections (admin-entered, so it is escaped and length-capped).
const sendStoreStatusChangeEmail = async (managerEmail, managerName, storeName, newStatus, reason) => {
    const STATUS_CONTENT = {
        pending: {
            emoji: '⏳', subject: `Store Update — ${storeName}`,
            body: `Your store <strong>"${storeName}"</strong> status has been set to <strong>Pending</strong>. Please contact support if you have questions.`
        },
        under_review: {
            emoji: '🔍', subject: `Your Store "${storeName}" is Under Review`,
            body: `Your store <strong>"${storeName}"</strong> is now under review by our compliance team. We'll notify you once the review is complete (usually within 24 hours).`
        },
        verified: {
            emoji: '✅', subject: `Store "${storeName}" Verified!`,
            body: `Your store <strong>"${storeName}"</strong> has been verified! You can now go live and start taking orders.`
        },
        rejected: {
            emoji: '❌', subject: `Action Required — Store "${storeName}"`,
            body: `Unfortunately, your store application for <strong>"${storeName}"</strong> could not be approved at this time. Please review your submitted documents (GST / FSSAI / Bank details) and re-submit via the Partner Dashboard. If you need help, reply to this email.`
        },
    };

    const cleanReason = newStatus === 'rejected' && typeof reason === 'string' ? reason.trim().slice(0, 200) : '';
    if (cleanReason) {
        STATUS_CONTENT.rejected.body += `<br><br><strong>Reason from our review team:</strong> ${escapeHtml(cleanReason)}`;
    }

    const content = STATUS_CONTENT[newStatus] || {
        emoji: '📋',
        subject: `Store Status Update — ${storeName}`,
        body: `Your store <strong>"${storeName}"</strong> status has been updated to: <strong>${newStatus}</strong>.`
    };

    await sendMail({
        to: managerEmail,
        subject: `${content.emoji} ${content.subject}`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #0f172a;">
            <div style="text-align: center; margin-bottom: 24px; font-size: 40px;">${content.emoji}</div>
            <h1 style="text-align: center; font-size: 20px; font-weight: 800; margin-bottom: 12px;">${content.subject}</h1>
            <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
                Hello <strong>${managerName}</strong>,<br><br>
                ${content.body}
            </p>
            <div style="text-align: center; margin: 24px 0;">
                <a href="http://localhost:5173/manager/dashboard" style="display: inline-block; padding: 12px 24px; background: #0f172a; color: #fff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px;">
                    View Partner Dashboard →
                </a>
            </div>
            <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 24px;">— Velvet Plate Partner Team</p>
        </div>
        `
    });
};

const sendOnboardingSubmissionEmail = async (managerEmail, managerName, storeName) => {
    await sendMail({
        to: managerEmail,
        subject: `📝 Application Received — ${storeName}`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #0f172a;">
            <div style="text-align: center; margin-bottom: 24px; font-size: 40px;">📝</div>
            <h1 style="text-align: center; font-size: 20px; font-weight: 800; margin-bottom: 12px;">Application Received</h1>
            <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
                Hello <strong>${managerName}</strong>,<br><br>
                Thank you for applying to partner with Velvet Plate! We have received your application for <strong>"${storeName}"</strong>.<br><br>
                Our team will review your documents (GST, FSSAI, and Bank details) and get back to you within 24-48 hours. You can track your application status in the Partner Dashboard.
            </p>
            <div style="text-align: center; margin: 24px 0;">
                <a href="http://localhost:5173/manager/status" style="display: inline-block; padding: 12px 24px; background: #FF5A00; color: #fff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px;">
                    Check Application Status →
                </a>
            </div>
            <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 24px;">— Velvet Plate Onboarding Team</p>
        </div>
        `
    });
};

/**
 * Sent to customer after successful order placement.
 */
const sendOrderConfirmationEmail = async (customerEmail, customerName, orderId, orderTotal, items) => {
    const itemsHtml = items.map(item => `
        <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${item.productName} x ${item.quantity}</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-align: right;">₹${item.totalPrice}</td>
        </tr>
    `).join('');

    await sendMail({
        to: customerEmail,
        subject: `🍕 Your Velvet Plate Order #${orderId.slice(-6).toUpperCase()} is Confirmed!`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #0f172a; border: 1px solid #f1f5f9; border-radius: 20px;">
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 48px; height: 48px; border-radius: 12px; background: #FF5A00; color: #fff; font-size: 24px; font-weight: 900; line-height: 48px;">V</div>
            </div>
            <h1 style="text-align: center; font-size: 20px; font-weight: 800; margin-bottom: 12px;">Order Confirmed!</h1>
            <p style="text-align: center; color: #475569; font-size: 15px; margin-bottom: 24px;">
                Hi ${customerName}, your order has been received and is being sent to the kitchen.
            </p>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 16px; margin-bottom: 24px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    ${itemsHtml}
                    <tr>
                        <td style="padding: 12px 0 0; font-weight: 800;">Total</td>
                        <td style="padding: 12px 0 0; font-weight: 800; text-align: right; color: #FF5A00; font-size: 18px;">₹${orderTotal}</td>
                    </tr>
                </table>
            </div>

            <div style="text-align: center; margin: 28px 0;">
                <a href="http://localhost:5173/order-tracking/${orderId}" style="display: inline-block; padding: 13px 28px; background: #0f172a; color: #fff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px;">
                    Track Order Status →
                </a>
            </div>
            <p style="text-align: center; color: #94a3b8; font-size: 12px;">Order ID: ${orderId}</p>
        </div>
        `
    });
};

/**
 * Sent to customer when order status changes (PREPARING, READY, etc.)
 */
const sendOrderStatusUpdateEmail = async (customerEmail, customerName, orderId, newStatus) => {
    const STATUS_MAP = {
        'PREPARING': { emoji: '👨‍🍳', text: 'is being prepared' },
        'READY': { emoji: '🥡', text: 'is ready for pickup/delivery' },
        'COMPLETED': { emoji: '✅', text: 'has been completed. Enjoy your meal!' },
        'CANCELLED': { emoji: '❌', text: 'has been cancelled' }
    };

    const info = STATUS_MAP[newStatus] || { emoji: '📄', text: `status is now: ${newStatus}` };

    await sendMail({
        to: customerEmail,
        subject: `${info.emoji} Order Update: #${orderId.slice(-6).toUpperCase()} ${newStatus}`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #0f172a;">
            <div style="text-align: center; margin-bottom: 20px; font-size: 40px;">${info.emoji}</div>
            <h1 style="text-align: center; font-size: 20px; font-weight: 800; margin-bottom: 12px;">Order Update</h1>
            <p style="text-align: center; color: #475569; font-size: 16px; line-height: 1.6;">
                Hi ${customerName}, your order <strong>#${orderId.slice(-6).toUpperCase()}</strong> ${info.text}.
            </p>
            <div style="text-align: center; margin: 28px 0;">
                <a href="http://localhost:5173/order-tracking/${orderId}" style="display: inline-block; padding: 13px 28px; background: #FF5A00; color: #fff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px;">
                    View Live Tracking →
                </a>
            </div>
        </div>
        `
    });
};

/**
 * Sent to support team when a manager clicks "Urgent Uplink".
 */
const sendUrgentUplinkEmail = async (adminEmail, managerEmail, managerName, storeName, referenceId) => {
    await sendMail({
        to: adminEmail, // Dynamic admin email
        subject: `🚨 URGENT UPLINK: Support Request from ${storeName}`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; border: 2px solid #ef4444; border-radius: 24px; color: #0f172a;">
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; padding: 10px 20px; background: #fee2e2; color: #ef4444; border-radius: 12px; font-weight: 900; font-size: 14px; letter-spacing: 0.1em; text-transform: uppercase;">
                    Urgent Support Request
                </div>
            </div>
            
            <h1 style="font-size: 20px; font-weight: 800; margin-bottom: 16px;">Protocol Support Required</h1>
            
            <div style="background: #f8fafc; padding: 24px; border-radius: 16px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
                <p style="margin: 0 0 12px 0; font-size: 14px; color: #64748b;"><strong>Store Name:</strong> ${storeName}</p>
                <p style="margin: 0 0 12px 0; font-size: 14px; color: #64748b;"><strong>Manager:</strong> ${managerName}</p>
                <p style="margin: 0 0 12px 0; font-size: 14px; color: #64748b;"><strong>Contact Email:</strong> ${managerEmail}</p>
                <p style="margin: 12px 0 0 0; font-size: 14px; color: #64748b; padding-top: 12px; border-top: 1px dashed #cbd5e1;"><strong>Reference ID:</strong> <span style="font-family: monospace; font-weight: 800; color: #0f172a;">${referenceId}</span></p>
            </div>

            <p style="font-size: 14px; color: #475569; line-height: 1.6;">
                The manager has triggered the <strong>Urgent Uplink</strong> protocol from their status dashboard. 
                Please initiate high-fidelity verification of their entity credentials manually.
            </p>

            <div style="text-align: center; margin-top: 32px; font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">
                — Velvet Plate Compliance Automated System
            </div>
        </div>
        `
    });
};

module.exports = {
    sendManagerAccountVerifiedEmail,
    sendManagerWelcomeEmail,
    sendWelcomeEmail,
    sendStoreVerifiedEmail,
    sendStoreStatusChangeEmail,
    sendOnboardingSubmissionEmail,
    sendOrderConfirmationEmail,
    sendOrderStatusUpdateEmail,
    sendUrgentUplinkEmail
};
