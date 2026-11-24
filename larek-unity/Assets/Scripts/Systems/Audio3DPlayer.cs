using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;

namespace Larek.Systems
{
    /// <summary>
    /// Тонкая Unity-обвязка каталога <see cref="AudioSystem"/>: загружает mp3 из StreamingAssets
    /// и проигрывает их пространственно. Чистые модели верхних уровней не зависят от Unity API.
    /// </summary>
    [RequireComponent(typeof(AudioSource))]
    public sealed class Audio3DPlayer : MonoBehaviour
    {
        public static Audio3DPlayer Instance { get; private set; }

        [SerializeField] private float defaultVolume = 1f;
        [SerializeField] private float minDistance = 1.2f;
        [SerializeField] private float maxDistance = 80f;

        private readonly Dictionary<string, AudioClip> clips =
            new Dictionary<string, AudioClip>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, Coroutine> loads =
            new Dictionary<string, Coroutine>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, AudioSource> loops =
            new Dictionary<string, AudioSource>(StringComparer.OrdinalIgnoreCase);

        private AudioSource template;
        private AudioClip beepClip;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(this);
                return;
            }

            Instance = this;
            template = GetComponent<AudioSource>();
            Configure(template);
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        /// <summary>Полный путь к файлу: на Android Application.streamingAssetsPath остаётся jar-URL.</summary>
        public static string FullPath(AudioClipInfo info)
        {
            if (info == null) return string.Empty;
            return Application.streamingAssetsPath + "/" + AudioSystem.StreamingFolder + "/" + info.FileName;
        }

        /// <summary>Воспроизведение звука по логическому имени, имени файла или псевдониму.</summary>
        /// <param name="id">Например, "shot", "gunshot", "tv_ch3" или "walk.mp3".</param>
        /// <param name="position">Положение источника в мире.</param>
        /// <param name="volume">Громкость источника (0..1).</param>
        /// <param name="loop">Зациклить (радио, город, телевизор, двигатели).</param>
        public bool Play(string id, Vector3 position, float volume = 1f, bool loop = false)
        {
            if (string.Equals(id, "beep", StringComparison.OrdinalIgnoreCase)
                || string.Equals(id, "exit_beep", StringComparison.OrdinalIgnoreCase))
            {
                PlayBeep(position, volume);
                return true;
            }

            AudioClipInfo info = AudioSystem.Find(id);
            if (info == null) return false;

            string eventId = info.Id;
            AudioClip clip;
            if (!clips.TryGetValue(eventId, out clip) || clip == null)
            {
                Load(eventId, info, loaded => StartClip(loaded, info, position, volume, loop));
                return true; // звук известен, идёт загрузка из StreamingAssets
            }

            StartClip(clip, info, position, volume, loop);
            return true;
        }

        /// <summary>Псевдоним для вызовов в стиле WorldAudio.</summary>
        public bool PlayAt(string id, Vector3 position, float volume = 1f, bool loop = false)
        {
            return Play(id, position, volume, loop);
        }

        /// <summary>Кнопка «ВЫХОД» в подъезде: короткий сигнал (M25).</summary>
        public void PlayBeep(Vector3 position, float volume = 1f)
        {
            if (beepClip == null) beepClip = CreateBeepClip();
            SpawnOneShot(beepClip, position, volume * 0.7f, false);
        }

        /// <summary>Кнопка «ВЫХОД»: щёлок магнитного замка (M26).</summary>
        public bool PlayMagnetClick(Vector3 position, float volume = 1f)
        {
            return Play("magnet_click", position, volume, false);
        }

        /// <summary>Остановить зацикленный источник (например, при выключении радио или телевизора).</summary>
        public bool Stop(string id)
        {
            AudioClipInfo info = AudioSystem.Find(id);
            if (info == null) return false;
            AudioSource source;
            if (!loops.TryGetValue(info.Id, out source) || source == null) return false;
            source.Stop();
            Destroy(source.gameObject);
            loops.Remove(info.Id);
            return true;
        }

        public void StopAll()
        {
            foreach (KeyValuePair<string, AudioSource> pair in loops)
            {
                if (pair.Value != null) Destroy(pair.Value.gameObject);
            }
            loops.Clear();
        }

        /// <summary>Громкость всех новых источников; уже играющие источники не меняются.</summary>
        public void SetDefaultVolume(float value)
        {
            defaultVolume = Mathf.Clamp01(value);
        }

        private void StartClip(AudioClip clip, AudioClipInfo info, Vector3 position, float volume, bool loop)
        {
            if (loop || info.Loop)
            {
                AudioSource source;
                if (!loops.TryGetValue(info.Id, out source) || source == null)
                {
                    GameObject holder = new GameObject("Звук: " + info.FileWithoutExtension);
                    holder.transform.SetParent(transform, false);
                    source = holder.AddComponent<AudioSource>();
                    Configure(source);
                    loops[info.Id] = source;
                }
                source.transform.position = position;
                source.clip = clip;
                source.loop = true;
                source.volume = Mathf.Clamp01(volume) * defaultVolume;
                if (!source.isPlaying) source.Play();
                return;
            }

            SpawnOneShot(clip, position, volume, false);
        }

        private void SpawnOneShot(AudioClip clip, Vector3 position, float volume, bool loop)
        {
            if (clip == null) return;
            GameObject holder = new GameObject("Звук: " + clip.name);
            holder.transform.SetParent(transform, false);
            holder.transform.position = position;
            AudioSource source = holder.AddComponent<AudioSource>();
            Configure(source);
            source.clip = clip;
            source.loop = loop;
            source.volume = Mathf.Clamp01(volume) * defaultVolume;
            source.Play();
            if (!loop) Destroy(holder, clip.length + 0.1f);
        }

        private void Load(string eventId, AudioClipInfo info, Action<AudioClip> onLoaded)
        {
            Coroutine pending;
            if (loads.TryGetValue(eventId, out pending) && pending != null) return;
            loads[eventId] = StartCoroutine(LoadRoutine(eventId, info, onLoaded));
        }

        private IEnumerator LoadRoutine(string eventId, AudioClipInfo info, Action<AudioClip> onLoaded)
        {
            string path = FullPath(info);
            using (UnityWebRequest request = UnityWebRequestMultimedia.GetAudioClip(path, AudioType.MPEG))
            {
                yield return request.SendWebRequest();
#if UNITY_2020_1_OR_NEWER
                bool failed = request.result != UnityWebRequest.Result.Success;
#else
                bool failed = request.isNetworkError || request.isHttpError;
#endif
                if (failed)
                {
                    Debug.LogWarning("Не удалось загрузить звук " + path + ": " + request.error);
                }
                else
                {
                    AudioClip clip = DownloadHandlerAudioClip.GetContent(request);
                    if (clip != null)
                    {
                        clip.name = info.FileWithoutExtension;
                        clips[eventId] = clip;
                        if (onLoaded != null) onLoaded(clip);
                    }
                }
            }
            loads.Remove(eventId);
        }

        private void Configure(AudioSource source)
        {
            if (source == null) return;
            source.playOnAwake = false;
            source.spatialBlend = 1f;
            source.rolloffMode = AudioRolloffMode.Logarithmic;
            source.minDistance = Mathf.Max(0.01f, minDistance);
            source.maxDistance = Mathf.Max(source.minDistance + 1f, maxDistance);
            source.dopplerLevel = 0f;
            source.volume = Mathf.Clamp01(defaultVolume);
        }

        private static AudioClip CreateBeepClip()
        {
            const int sampleRate = 44100;
            const float duration = 0.09f;
            int length = Mathf.CeilToInt(sampleRate * duration);
            float[] samples = new float[length];
            for (int i = 0; i < length; i++)
            {
                float t = (float)i / sampleRate;
                float fade = 1f - (float)i / length;
                samples[i] = Mathf.Sin(2f * Mathf.PI * 880f * t) * fade * 0.28f;
            }
            AudioClip clip = AudioClip.Create("ExitButtonBeep", length, 1, sampleRate, false);
            clip.SetData(samples, 0);
            return clip;
        }
    }
}
