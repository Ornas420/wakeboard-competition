import { Routes, Route } from 'react-router-dom';

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white p-4">
        <h1 className="text-2xl font-bold">Wakeboard Competition System</h1>
      </header>
      <main className="container mx-auto p-4">
        <Routes>
          <Route path="/" element={<p>Welcome to the Wakeboard Competition System</p>} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
