import React from 'react';
import { FaUserTie, FaTools, FaRegLightbulb, FaBuilding } from 'react-icons/fa';

const Ownership = () => {
  const teamMembers = [
    { name: 'Abdul Kareem', role: 'Frontend Developer', icon: <FaUserTie />, link: 'https://linkedin.com/in/mohammedabdul-kareem' },
    { name: 'Abdulla Hussain', role: 'Lead Developer & AI Integration', icon: <FaUserTie />, link: 'https://www.linkedin.com/in/abdulla-hussain-526801279?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app' },
    { name: 'Khaleel Ullah', role: 'Testing & QA Engineer', icon: <FaUserTie />, link: 'https://www.linkedin.com/in/mohd-khaleel-ullah-266627337?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app' },
    { name: 'Manishwar Moturi', role: 'Backend & Database Architect', icon: <FaUserTie />, link: 'https://www.linkedin.com/in/manishwar-moturi-571746323?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app' },
    { name: 'P. Mohit', role: 'Frontend Developer', icon: <FaUserTie />, link: 'https://linkedin.com/' },
  ];

  return (
    <div className="ownership-container fade-in">
      {/* Header Section */}
      <header className="ownership-header">
        <h1 className="title">⚙️ Project Ownership</h1>
        <p className="subtitle">
          Meet the minds behind the <strong>AI-Powered Code Review Platform</strong>.  
          Designed to make coding smarter, cleaner, and faster.
        </p>
      </header>

      {/* Team Section */}
      <section className="ownership-section">
        <h2 className="section-title">👨‍💻 Development Team</h2>
        <div className="team-grid">
          {teamMembers.map((member, i) => (
            <div
              key={i}
              className="team-card slide-up"
              style={{ animationDelay: `${i * 0.1}s` }}
              onClick={() => window.open(member.link, '_blank')}
            >
              <div className="team-icon">{member.icon}</div>
              <h3 className="team-name">{member.name}</h3>
            </div>
          ))}
        </div>
      </section>

      {/* Technologies Section */}
      <section className="ownership-section">
        <h2 className="section-title"><FaTools /> Technology Stack</h2>
        <ul className="tech-list">
          <li><strong>Frontend:</strong> React (Vite), Glassmorphism UI</li>
          <li><strong>Backend:</strong> Node.js + Express</li>
          <li><strong>Database:</strong> Supabase (PostgreSQL)</li>
          <li><strong>AI Engine:</strong> Google Gemini API</li>
          <li><strong>Integration:</strong> GitHub OAuth + CI/CD</li>
          <li><strong>Hosting:</strong> Vercel / Netlify</li>
        </ul>
      </section>

      {/* Project Purpose Section */}
      <section className="ownership-section">
        <h2 className="section-title"><FaRegLightbulb /> Project Vision</h2>
        <p className="vision-text">
          The Code Review Bot automates code review, identifies bugs, and suggests real-time improvements using AI.  
          It empowers developers and teams to maintain cleaner, more efficient, and production-ready code.
        </p>
      </section>

      {/* Credits Section */}
      <section className="ownership-section">
        <h2 className="section-title"><FaBuilding /> Organization & Credits</h2>
        <p className="credits-text">
           
          Guided and mentored Developed as part of an innovative software project under the <strong>Department of Computer Science & Engineering, KMIT</strong>.
Created by the student team as part of their <strong>Project School Initiative</strong>.by <strong>Faculty of Computer Science & Engineering Department</strong>.
        </p>
      </section>

      {/* Footer Section */}
      <footer className="ownership-footer">
        <p>© {new Date().getFullYear()} Code Review Bot. All rights reserved.</p>
      </footer>

      {/* Embedded Styles */}
      <style>{`
        .ownership-container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 3rem 1.5rem;
          color: #f8fafc;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          border-radius: 20px;
        }

        .ownership-header {
          text-align: center;
          margin-bottom: 3rem;
        }

        .title {
          font-size: 2.5rem;
          font-weight: 800;
          margin-bottom: 1rem;
          background: linear-gradient(to right, #60a5fa, #a855f7);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .subtitle {
          font-size: 1.2rem;
          color: rgba(255,255,255,0.8);
        }

        .ownership-section {
          margin-bottom: 3rem;
        }

        .section-title {
          font-size: 1.8rem;
          font-weight: 700;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #93c5fd;
        }

        .team-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1.5rem;
        }

        .team-card {
          background: rgba(255,255,255,0.05);
          padding: 1.5rem;
          border-radius: 12px;
          text-align: center;
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
          cursor: pointer;
        }

        .team-card:hover {
          transform: translateY(-5px) scale(1.03);
          box-shadow: 0 8px 30px rgba(0,0,0,0.3);
          background: rgba(96,165,250,0.15);
        }

        .team-icon {
          font-size: 2rem;
          margin-bottom: 0.75rem;
          color: #60a5fa;
        }

        .team-name {
          font-size: 1.2rem;
          font-weight: 600;
        }

        .team-role {
          color: rgba(255,255,255,0.7);
          font-size: 0.95rem;
        }

        .tech-list {
          background: rgba(255,255,255,0.05);
          padding: 1.5rem 2rem;
          border-radius: 12px;
          line-height: 1.8;
          color: rgba(255,255,255,0.9);
        }

        .vision-text, .credits-text {
          background: rgba(255,255,255,0.05);
          padding: 1.5rem;
          border-radius: 12px;
          color: rgba(255,255,255,0.85);
          font-size: 1.05rem;
          line-height: 1.8;
        }

        .ownership-footer {
          text-align: center;
          margin-top: 3rem;
          padding-top: 2rem;
          border-top: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.7);
          font-size: 0.95rem;
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .fade-in {
          animation: fade-in 0.8s ease forwards;
        }

        .slide-up {
          animation: fade-in 0.7s ease forwards;
        }
      `}</style>
    </div>
  );
};

export default Ownership;
