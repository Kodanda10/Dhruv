export default function DocsPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">दस्तावेज़</h1>
      <p>
        यह पृष्ठ प्रोजेक्ट ध्रुव के बारे में संक्षिप्त जानकारी देता है। अधिक विवरण के लिए
        <a className="text-blue-600 underline ml-1" href="/runbook.md"> runbook.md</a> देखें।
      </p>
      <ul className="list-disc list-inside">
        <li>
          हेल्थ: <code>/api/health</code>
        </li>
        <li>
          फीचर फ्लैग: <code>FLAG_PARSE</code>
        </li>
      </ul>
    </main>
  );
}

