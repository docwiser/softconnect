<template>
  <div class="policy-page" id="main-content">
    <header class="policy-header">
      <RouterLink to="/auth" class="back-btn" aria-label="Back to sign in">
        <span aria-hidden="true">←</span> Back
      </RouterLink>
      <h1 class="policy-title">User Generated Content Disclosure</h1>
    </header>

    <main class="policy-content">
      <section>
        <h2>1. User Responsibility</h2>
        <p>SoftConnect is a platform for communication. All content shared on the platform is the sole responsibility of the user who generated it.</p>
      </section>

      <section>
        <h2>2. Content Standards</h2>
        <p>Users are expected to adhere to community standards. Prohibited content includes but is not limited to: hate speech, illegal material, and content that infringes on others' rights.</p>
      </section>

      <section>
        <h2>3. Reporting Content</h2>
        <p>If you encounter content that violates our terms, please report it immediately through the provided reporting tools or contact support.</p>
      </section>

      <section>
        <h2>4. Moderation</h2>
        <p>While we respect privacy, we reserve the right to remove content that violates our policies or is reported by other users.</p>
      </section>

      <p class="last-updated">Last updated: April 2026</p>
    </main>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
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
