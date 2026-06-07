import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <Link to="/" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">Privacy Policy</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6 text-sm text-gray-700 leading-relaxed">
        <p className="text-xs text-gray-400">Last updated: June 7, 2026</p>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">What is Rozka AI?</h2>
          <p>
            Rozka AI is a personal life-companion app that helps you manage tasks, expenses,
            daily notes, and email. It runs as a Progressive Web App (PWA) hosted on GitHub Pages.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">Data we store locally</h2>
          <p>
            Your tasks, expenses, notes, and preferences are stored in your browser's local
            storage on your device. We do not have a central database that collects this data.
            Optional cloud sync uses your own GitHub account.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">Gmail integration</h2>
          <p>When you choose to connect your Gmail account, Rozka AI requests the following permissions:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>gmail.readonly</strong> — to read your inbox and show messages inside the app</li>
            <li><strong>gmail.compose</strong> — to create draft replies using AI (Amazon Bedrock). Drafts appear in your Gmail Drafts folder.</li>
          </ul>
          <p className="font-medium text-gray-900 mt-3">What we do:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Read your inbox to display human messages (we skip newsletters, receipts, and automated emails)</li>
            <li>Generate AI draft replies and save them as Gmail Drafts</li>
            <li>Let you review, edit, and manually send drafts from the app</li>
          </ul>
          <p className="font-medium text-gray-900 mt-3">What we do NOT do:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>We never send email automatically — you always press Send</li>
            <li>We never share your email content with third parties</li>
            <li>We never store email content permanently — messages are fetched on demand</li>
            <li>We never use your data for advertising</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">Gmail token storage</h2>
          <p>
            Your Gmail OAuth tokens are stored encrypted (AES-256) in a private AWS S3 bucket.
            Tokens are tied to your Rozka account ID. Only the Rozka backend Lambda function can
            decrypt them at runtime. No human has access to your raw tokens.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">Disconnecting Gmail</h2>
          <p>
            You can disconnect your Gmail at any time from Settings. This immediately deletes
            your stored tokens. You can also revoke access from your{' '}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 underline"
            >
              Google Account permissions
            </a>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">AI processing</h2>
          <p>
            When generating draft replies, the email content is sent to Amazon Bedrock (AWS AI service)
            for processing. Amazon Bedrock does not store your data or use it for model training.
            Processing happens in the AWS ap-south-1 (Mumbai) region.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">Third-party services</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>GitHub Pages</strong> — hosts the web app (static files only)</li>
            <li><strong>AWS Lambda + S3</strong> — Gmail integration backend and token storage</li>
            <li><strong>Amazon Bedrock</strong> — AI draft generation</li>
            <li><strong>Google Gmail API</strong> — inbox access with your explicit permission</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">Data deletion</h2>
          <p>
            To delete all your data: disconnect Gmail in Settings, then clear site data in your
            browser. This removes all local data and revokes Gmail access. For token deletion
            on AWS, disconnecting from the app automatically deletes your stored tokens.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">Contact</h2>
          <p>
            If you have questions about this privacy policy or your data, contact the developer
            through the{' '}
            <a
              href="https://github.com/edquad/daylife/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 underline"
            >
              GitHub repository
            </a>.
          </p>
        </section>

        <hr className="border-gray-200" />
        <p className="text-xs text-gray-400">
          This policy applies to the Rozka AI app at edquad.github.io/daylife.
        </p>
      </main>
    </div>
  );
}
