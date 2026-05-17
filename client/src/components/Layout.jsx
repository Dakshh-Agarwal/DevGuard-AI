import React from 'react';
import Header from './Header';
import Footer from './Footer';

const Layout = ({ children, className = "" }) => {
  return (
    <div className={`app-layout ${className}`}>
      <Header />
      <main className="main-content">
        {children}
      </main>
      <Footer />

      <style >{`
        .app-layout {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        }

        .main-content {
          flex: 1;
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
          padding: 2rem;
          min-height: calc(100vh - 140px); /* Account for header and footer */
        }

        @media (max-width: 768px) {
          .main-content {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default Layout;