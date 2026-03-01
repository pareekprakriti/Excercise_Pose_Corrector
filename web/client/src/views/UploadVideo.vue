<script setup>
import { ref } from "vue";
import axios from "axios";

import Dropzone from "../components/Dropzone.vue";
import DropzoneLoading from "../components/DropzoneLoading.vue";
import Result from "../components/Result.vue";

// Allow overriding backend base URL via Vite env
const API_BASE_URL = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

const selectedExercise = ref("bicep_curl");
const isUploading = ref(false);
const errorMessage = ref("");
const analysisResult = ref(null);

const exercises = [
  { value: "bicep_curl", label: "Bicep Curl" },
  { value: "plank", label: "Plank" },
  { value: "squat", label: "Squat" },
  { value: "lunge", label: "Lunge" },
];

const handleFileUploaded = async (file) => {
  errorMessage.value = "";
  analysisResult.value = null;

  if (!file) {
    errorMessage.value = "Please select a video file.";
    return;
  }

  isUploading.value = true;

  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await axios.post(
      `${API_BASE_URL}/api/video/upload?type=${selectedExercise.value}`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    analysisResult.value = response.data;
  } catch (err) {
    console.error("Upload/analysis error:", err);
    if (err.response) {
      const { status, data } = err.response;
      errorMessage.value =
        data?.error ||
        data?.message ||
        `Server error (${status}). Check Django logs.`;
    } else {
      errorMessage.value =
        "Network error: cannot reach AI backend. Is Django running?";
    }
  } finally {
    isUploading.value = false;
  }
};
</script>

<template>
  <section class="upload-page">
    <h1 class="title">Upload Exercise Video</h1>

    <!-- Exercise selector -->
    <div class="controls">
      <label for="exercise">Exercise</label>
      <select
        id="exercise"
        v-model="selectedExercise"
        class="exercise-select"
      >
        <option
          v-for="ex in exercises"
          :key="ex.value"
          :value="ex.value"
        >
          {{ ex.label }}
        </option>
      </select>
    </div>

    <!-- Upload area / loading state -->
    <div class="upload-container">
      <Dropzone
        v-if="!isUploading"
        @fileUploaded="handleFileUploaded"
      />
      <DropzoneLoading v-else />
    </div>

    <!-- Error banner -->
    <p v-if="errorMessage" class="error-text">
      {{ errorMessage }}
    </p>

    <!-- Analysis result -->
    <Result
      v-if="analysisResult"
      :data="analysisResult"
    />
  </section>
</template>

<style scoped lang="scss">
.upload-page {
  margin-top: 4rem;
  margin-bottom: 4rem;

  .title {
    text-align: center;
    font-size: 2rem;
    color: var(--primary-color);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 2rem;
  }

  .controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;

    label {
      font-weight: 600;
    }

    .exercise-select {
      padding: 0.4rem 0.75rem;
      border-radius: 999px;
      border: 1px solid var(--primary-color);
      min-width: 180px;
    }
  }

  .upload-container {
    max-width: 600px;
    margin-inline: auto;
  }

  .error-text {
    margin-top: 1rem;
    text-align: center;
    color: #ff4d4d;
    font-weight: 600;
  }
}
</style>

