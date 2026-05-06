<template>
  <div class="policy-page" id="main-content">
    <SubPageHeader title="About SoftConnect" />

    <main class="policy-content">
      <div class="about-hero">
        <span class="brand-icon">◈</span>
        <h2>SoftConnect</h2>
        <p class="tagline">Open. Private. Yours.</p>
      </div>

      <section>
        <p>SoftConnect is a modern communication platform built with privacy and user experience at its core. Our mission is to provide a seamless, secure, and open environment for individuals and teams to connect.</p>
      </section>

      <section>
        <h2>Our Vision</h2>
        <p>We believe in a web where communication is decentralized, private, and accessible to everyone. SoftConnect is our contribution to that future.</p>
      </section>

      <section>
        <h2>Key Features</h2>
        <ul>
          <li>Real-time messaging with rich media support.</li>
          <li>High-quality video and audio meetings.</li>
          <li>Privacy-first approach: minimal data collection.</li>
          <li>User-friendly interface inspired by the best in the industry.</li>
        </ul>
      </section>

      <p class="version">Version 1.0.0</p>
    </main>
  </div>
</template>

<script setup lang="ts">
import SubPageHeader from './SubPageHeader.vue'
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Syne:wght@700&display=swap');

.policy-page {
  min-height: 100vh;
  background: #060812;
  color: #e2e8f0;
  font-family: 'DM Sans', sans-serif;
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

.policy-header {
  display: flex;
  align-items: center;
  gap: 2rem;
  margin-bottom: 3rem;
}

.back-btn {
  color: #7c6fff;
  text-decoration: none;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.policy-title {
  font-family: 'Syne', sans-serif;
  font-size: 2rem;
  margin: 0;
}

.policy-content {
  line-height: 1.6;
}

.about-hero {
  text-align: center;
  margin-bottom: 3rem;
  padding: 2rem;
  background: rgba(92, 59, 255, 0.05);
  border-radius: 24px;
}

.brand-icon {
  font-size: 3rem;
  background: linear-gradient(135deg, #5c3bff, #ff3b8c);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  display: block;
  margin-bottom: 1rem;
}

.tagline {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.875rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

section {
  margin-bottom: 2rem;
}

h2 {
  color: #fff;
  font-size: 1.25rem;
  margin-bottom: 1rem;
}

p {
  color: rgba(226, 232, 240, 0.8);
}

ul {
  padding-left: 1.25rem;
  color: rgba(226, 232, 240, 0.8);
}

li {
  margin-bottom: 0.5rem;
}

.version {
  margin-top: 4rem;
  font-size: 0.875rem;
  color: rgba(226, 232, 240, 0.3);
  text-align: center;
}
</style>
