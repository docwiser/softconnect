<template>
  <div class="policy-page" id="main-content">
    <SubPageHeader title="Terms of Use" />

    <main class="policy-content">
      <section>
        <h2>1. Acceptance of Terms</h2>
        <p>By using SoftConnect, you agree to abide by these terms. If you do not agree, please do not use the service.</p>
      </section>

      <section>
        <h2>2. User Conduct</h2>
        <p>You agree to use SoftConnect for lawful purposes only. Harassment, abuse, or any illegal activities are strictly prohibited.</p>
      </section>

      <section>
        <h2>3. Account Responsibility</h2>
        <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>
      </section>

      <section>
        <h2>4. Termination</h2>
        <p>We reserve the right to suspend or terminate accounts that violate our terms or community guidelines.</p>
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
