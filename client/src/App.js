import React, { useState } from 'react';
import './App.css';

function App() {
  const [url, setUrl] = useState('http://127.0.0.1:7860');
  const [text, setText] = useState("what's in the picture?");
  const [image, setImage] = useState(null);
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setIsLoading(true);
    setResponse('');

    const formData = new FormData();
    formData.append('url', url);
    formData.append('text', text);
    if (image) {
      formData.append('image', image);
    }

    try {
      const response = await fetch('https://gradio-demo-or08.onrender.com/api/chat', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let cumulativeMessage = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === 'DONE') {
              setIsLoading(false);
              return;
            } else if (data.startsWith('ERROR:')) {
              setResponse(data);
              setIsLoading(false);
              return;
            } else {
              try {
                const parsed = JSON.parse(data);
                cumulativeMessage = parsed.message;
                setResponse(cumulativeMessage);
              } catch (e) {
                console.error('Failed to parse SSE data:', data);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setResponse(`ERROR: ${error.message}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      <h1>Gradio Chat Demo</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Gradio URL:</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Text:</label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Image (optional):</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files[0])}
          />
        </div>
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Processing...' : 'Submit'}
        </button>
      </form>
      <div className="response">
        <h2>Response:</h2>
        <pre>{response}</pre>
      </div>
    </div>
  );
}

export default App;
