<template>
  <div class="policy-page" id="main-content">
    <SubPageHeader title="Help & Support" />

    <main class="policy-content">
      <section>
        <h2>Frequently Asked Questions</h2>
        <div class="faq-item">
          <h3>How do I start a new chat?</h3>
          <p>Go to the Dashboard and click on the "New Chat" button at the top or in the sidebar.</p>
        </div>
        <div class="faq-item">
          <h3>How do I join a meeting?</h3>
          <p>You can join a meeting using a code or link provided by the host. Enter the code in the "Join Meeting" section of the Dashboard.</p>
        </div>
        <div class="faq-item">
          <h3>Is SoftConnect secure?</h3>
          <p>Yes, we use industry-standard encryption to protect your data and communications.</p>
        </div>
      </section>

      <section>
        <h2>Contact Support</h2>
        <p>If you need further assistance, please reach out to our support team at <a href="mailto:support@softconnect.com">support@softconnect.com</a>.</p>
      </section>
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
  margin-bottom: 1.5rem;
}

h3 {
  color: #a78bfa;
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
}

.faq-item {
  margin-bottom: 1.5rem;
}

p {
  color: rgba(226, 232, 240, 0.8);
}

a {
  color: #7c6fff;
  text-decoration: none;
}
</style>
