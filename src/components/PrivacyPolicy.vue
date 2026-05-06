<template>
  <div class="policy-page" id="main-content">
    <SubPageHeader title="Privacy Policy" />

    <main class="policy-content">
      <section>
        <h2>1. Introduction</h2>
        <p>At SoftConnect, we prioritize your privacy. This policy explains how we handle your information.</p>
      </section>

      <section>
        <h2>2. Data Collection</h2>
        <p>We collect minimal data necessary for the service to function: your email, display name, and username. We do not sell your data to third parties.</p>
      </section>

      <section>
        <h2>3. Message Privacy</h2>
        <p>Your messages are yours. We provide a platform for communication and do not monitor your private conversations.</p>
      </section>

      <section>
        <h2>4. Security</h2>
        <p>We use industry-standard encryption and security practices to protect your account and data.</p>
      </section>

      <section>
        <h2>5. Changes to This Policy</h2>
        <p>We may update this policy from time to time. We will notify you of any significant changes.</p>
      </section>

      <p class="last-updated">Last updated: April 2026</p>
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

.last-updated {
  margin-top: 4rem;
  font-size: 0.875rem;
  color: rgba(226, 232, 240, 0.5);
}
</style>
