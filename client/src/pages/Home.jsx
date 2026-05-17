import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const Home = () => {
  const navigate = useNavigate();

  const handleGetStarted = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      navigate('/editor');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="home-container">
      {/* Hero Section */}
      <section className="hero-section fade-in">
        <div className="hero-content">
          <h1 className="hero-title">
            AI-Powered <br />
            <span className="gradient-text">Code Review</span>
          </h1>
          <p className="hero-subtitle">
            Transform your code quality with intelligent AI analysis. Get instant feedback, 
            suggestions, and improvements for multiple programming languages.
          </p>
          <div className="hero-buttons">
            <button onClick={handleGetStarted} className="btn btn-primary">
              🚀 Get Started Free
            </button>
            <Link to="/login" className="btn btn-secondary">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Powerful Features</h2>
          <p className="section-subtitle">Everything you need for better code</p>
        </div>

        <div className="features-grid">
          {[
            ['🤖', 'AI-Powered Analysis', 'Advanced ML analyzes your code for bugs, performance issues, and best practices.'],
            ['🌍', 'Multi-Language Support', 'Supports JavaScript, Python, Java, C++, and more.'],
            ['⚡', 'Instant Feedback', 'Real-time suggestions and automated fixes.'],
            ['👥', 'Team Collaboration', 'Share insights and collaborate on code reviews.'],
            ['📊', 'Analytics Dashboard', 'Track progress, view statistics, monitor improvements.'],
            ['🔒', 'Secure & Private', 'Processed securely with enterprise-grade encryption.']
          ].map(([icon, title, text], i) => (
            <div className="feature-card slide-up" style={{ animationDelay: `${i * 0.1}s` }} key={i}>
              <div className="feature-icon">{icon}</div>
              <h3 className="feature-title">{title}</h3>
              <p className="feature-text">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="section">
        <div className="section-header">
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">Simple steps to better code</p>
        </div>

        <div className="steps-grid">
          {[
            ['1', 'Upload Your Code', 'Paste or upload files securely.'],
            ['2', 'AI Analysis', 'Our AI analyzes your code for issues.'],
            ['3', 'Get Improvements', 'Receive detailed feedback instantly.']
          ].map(([num, title, text], i) => (
            <div className="step fade-in" style={{ animationDelay: `${i * 0.2}s` }} key={i}>
              <div className={`step-number step-${i+1}`}>{num}</div>
              <h3 className="step-title">{title}</h3>
              <p className="step-text">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-card">
          <h2 className="cta-title">Ready to Improve Your Code?</h2>
          <p className="cta-text">
            Join thousands of developers using our AI-powered code review platform.
          </p>
          <div className="cta-buttons">
            <button onClick={handleGetStarted} className="btn btn-success">Start Free Trial</button>
            <Link to="/signup" className="btn btn-outline">Create Account</Link>
          </div>
        </div>
      </section>

      {/* ========== Embedded CSS ========== */}
      <style>{`
        /* Base */
        .home-container {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          min-height: 100vh;
          color: white;
          font-family: 'Segoe UI', Tahoma, sans-serif;
          overflow-x: hidden;
        }
        .section {
          padding: 5rem 1rem;
          max-width: 1100px;
          margin: 0 auto;
        }
        .section-header {
          text-align: center;
          margin-bottom: 3rem;
        }
        .section-title {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }
        .section-subtitle {
          font-size: 1.1rem;
          opacity: 0.8;
        }

        /* Hero */
        .hero-section {
          text-align: center;
          padding: 7rem 1rem 5rem;
        }
        .hero-content {
          max-width: 800px;
          margin: 0 auto;
        }
        .hero-title {
          font-size: 3.5rem;
          font-weight: 800;
          line-height: 1.2;
          margin-bottom: 1rem;
        }
        .gradient-text {
          background: linear-gradient(to right, #fde047, #f9a8d4);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .hero-subtitle {
          font-size: 1.25rem;
          line-height: 1.7;
          opacity: 0.9;
          margin-bottom: 2rem;
        }
        .hero-buttons {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 1rem;
        }

        /* Buttons */
        .btn {
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.25s ease;
          text-decoration: none;
          display: inline-block;
        }
        .btn-primary {
          background: #2563eb;
          color: white;
        }
        .btn-primary:hover {
          background: #1e40af;
        }
        .btn-secondary {
          background: transparent;
          border: 2px solid #ffffff80;
          color: white;
        }
        .btn-secondary:hover {
          background: #ffffff1a;
        }
        .btn-success {
          background: #22c55e;
          color: white;
        }
        .btn-success:hover {
          background: #15803d;
        }
        .btn-outline {
          background: transparent;
          border: 2px solid #22c55e;
          color: #22c55e;
        }
        .btn-outline:hover {
          background: #22c55e;
          color: white;
        }

        /* Features */
        .features-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2rem;
        }
        @media (min-width: 768px) {
          .features-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        .feature-card {
          background: rgba(255,255,255,0.05);
          padding: 2rem;
          border-radius: 12px;
          text-align: center;
          backdrop-filter: blur(8px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
          transition: transform 0.3s ease;
        }
        .feature-card:hover {
          transform: translateY(-8px);
        }
        .feature-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        .feature-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        .feature-text {
          font-size: 1rem;
          opacity: 0.85;
          line-height: 1.6;
        }

        /* Steps */
        .steps-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2rem;
        }
        @media (min-width: 768px) {
          .steps-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        .step {
          text-align: center;
        }
        .step-number {
          width: 4rem;
          height: 4rem;
          margin: 0 auto 1rem;
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          color: white;
          font-weight: 700;
          font-size: 1.5rem;
        }
        .step-1 {
          background: linear-gradient(to right, #60a5fa, #a855f7);
        }
        .step-2 {
          background: linear-gradient(to right, #c084fc, #ec4899);
        }
        .step-3 {
          background: linear-gradient(to right, #f472b6, #ef4444);
        }
        .step-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        .step-text {
          opacity: 0.85;
          line-height: 1.6;
        }

        /* CTA */
        .cta-section {
          text-align: center;
          padding: 5rem 1rem;
        }
        .cta-card {
          background: rgba(255,255,255,0.08);
          padding: 3rem;
          max-width: 600px;
          margin: 0 auto;
          border-radius: 16px;
          backdrop-filter: blur(8px);
          box-shadow: 0 8px 30px rgba(0,0,0,0.3);
        }
        .cta-title {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 1rem;
        }
        .cta-text {
          opacity: 0.9;
          font-size: 1.1rem;
          margin-bottom: 2rem;
        }
        .cta-buttons {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 1rem;
        }

        /* Animations */
        .fade-in {
          animation: fadeIn 1s ease forwards;
          opacity: 0;
        }
        .slide-up {
          animation: slideUp 0.8s ease forwards;
          opacity: 0;
        }
        @keyframes fadeIn {
          from {opacity: 0; transform: translateY(20px);}
          to {opacity: 1; transform: translateY(0);}
        }
        @keyframes slideUp {
          from {opacity: 0; transform: translateY(40px);}
          to {opacity: 1; transform: translateY(0);}
        }
      `}</style>
    </div>
  );
};

export default Home;
