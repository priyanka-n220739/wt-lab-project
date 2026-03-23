const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'dummy@gmail.com',
    pass: process.env.EMAIL_PASS || 'dummy_pass'
  }
});

const sendEmail = async (to, subject, text) => {
  try {
    if (!process.env.EMAIL_USER) {
      console.log(`[Mock Email] To: ${to} | Subject: ${subject} | Body: ${text}`);
      return;
    }
    await transporter.sendMail({
      from: `"EduEvents" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
    });
    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

module.exports = sendEmail;
