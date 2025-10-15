// Main App Component
import React from 'react';
import UserList from './UserList';
import './styles.css';

function App() {
  return (
    <div className="container">
      <h1>User Management System</h1>
      <UserList />
    </div>
  );
}

export default App;
