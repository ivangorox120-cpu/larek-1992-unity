using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;

namespace Larek.World
{
    /// <summary>
    /// Пространственный звук мира «Ларёк 1992»: радио, телевизор, город, транспорт,
    /// шаги, гудок домофона и щелчок магнитного замка. MP3 грузятся только из
    /// StreamingAssets через UnityWebRequestMultimedia (никаких сетевых запросов).
    /// </summary>
    public sealed class WorldAudio : MonoBehaviour
    {
        public const string RadioKiosk = "radio_kiosk";
        public const string RadioApartment = "radio_apartment";
        public const string TvKiosk = "tv_kiosk";
        public const string TvApartment = "tv_apartment";
        public const string City = "city";
        public const string Horn = "horn";
        public const string BusEngine = "bus_engine";
        public const string CarEngine = "car_engine";
        public const string Footstep = "footstep";
        public const string FootstepSnow = "footstep_snow";
        public const string Anthem = "anthem";
        public const string IntercomBeep = "intercom_beep";
        public const string MagnetClick = "magnet_click";

        private const float FarCutoff = 22000f;
        private const float MuffledCutoff = 850f;

        private static readonly Dictionary<string, AudioClip> ClipCache =
            new Dictionary<string, AudioClip>(StringComparer.OrdinalIgnoreCase);
        private static readonly HashSet<string> Loading =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        private static readonly HashSet<string> Warned =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        [Header("Громкость")]
        [Range(0f, 1f)] public float RadioVolume = 0.48f;
        [Range(0f, 1f)] public float TvVolume = 0.55f;
        [Range(0f, 1f)] public float CityVolume = 0.32f;
        [Range(0f, 1f)] public float SfxVolume = 0.7f;

        [Header("Поведение")]
        public bool StartKioskRadio = true;
        public bool StartCityAmbience = true;
        public bool ApplyWallMuffling = true;

        private readonly Dictionary<string, AudioSource> sources =
            new Dictionary<string, AudioSource>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, AudioLowPassFilter> filters =
            new Dictionary<string, AudioLowPassFilter>(StringComparer.OrdinalIgnoreCase);

        private WorldBuilder builder;
        private AudioListener listener;
        private WorldWeather? lastWeather;
        private bool radioOn;
        private bool tvOn;
        private bool cityOn;
        private int tvChannel = 1;
        private AudioClip beepClip;

        /// <summary>Регистрирует стандартные источники мира на уже созданном компоненте.</summary>
        public void BuildDefaultSources(WorldBuilder world)
        {
            if (world == null) return;
            if (world.Audio == null) world.Audio = this;
            Initialize(world);
        }

        private void Initialize(WorldBuilder world)
        {
            builder = world;
            if (world.Audio == null) world.Audio = this;
            if (sources.Count > 0) return;

            radioOn = StartKioskRadio;
            cityOn = StartCityAmbience;
            tvOn = false;

            Transform kiosk = world.KioskRoot != null ? world.KioskRoot.transform : transform;
            Transform apartment = world.ApartmentRoot != null ? world.ApartmentRoot.transform : transform;
            Transform cityRoot = world.transform;

            RegisterSource(RadioKiosk, Host("Радио в ларьке", WorldAnchors.KioskRadio, kiosk),
                "radio.mp3", RadioVolume, 1f, 0.8f, 42f, true, radioOn);
            RegisterSource(RadioApartment, Host("Радио в квартире", WorldAnchors.ApartmentRadio, apartment),
                "radio.mp3", RadioVolume * 0.7f, 1f, 0.8f, 32f, true, false);

            RegisterSource(TvKiosk, Host("Телевизор «Рубин» в ларьке", WorldAnchors.KioskTv, kiosk),
                "tv_ch1.mp3", TvVolume * 0.7f, 1f, 1.2f, 30f, true, false);
            RegisterSource(TvApartment, Host("Телевизор «Рубин» в квартире", WorldAnchors.ApartmentTv, apartment),
                "tv_ch1.mp3", TvVolume, 1f, 1.35f, 32f, true, false);

            // Городской фон в оригинале не позиционируется, но через LowPassFilter
            // всё равно глушится стенами квартиры/ларька.
            RegisterSource(City, Host("Городской шум", WorldAnchors.Kiosk + Vector3.up * 3f, cityRoot),
                "city.mp3", CityVolume, 0.15f, 2f, 80f, true, cityOn);

            RegisterSource(Horn, Host("Сигнал ПАЗ-652", WorldAnchors.BusStart + Vector3.up * 2f, cityRoot),
                "horn.mp3", SfxVolume, 1f, 1.2f, 65f, false, false);
            RegisterSource(BusEngine, Host("Двигатель ПАЗ-652", WorldAnchors.BusStart + Vector3.up * 0.6f, cityRoot),
                "bus_engine.mp3", SfxVolume * 0.55f, 1f, 1.4f, 55f, true, false);
            RegisterSource(CarEngine, Host("Двигатель ВАЗ", new Vector3(-8f, 0.4f, 12f), cityRoot),
                "car_engine.mp3", SfxVolume * 0.42f, 1f, 1.2f, 42f, true, false);

            RegisterSource(Footstep, Host("Шаги по асфальту", WorldAnchors.Kiosk, transform),
                "walk.mp3", SfxVolume * 0.5f, 1f, 0.6f, 12f, false, false);
            RegisterSource(FootstepSnow, Host("Шаги по снегу", WorldAnchors.Kiosk, transform),
                "walk_snow.mp3", SfxVolume * 0.55f, 1f, 0.6f, 12f, false, false);

            RegisterSource(Anthem, Host("Гимн 1992", WorldAnchors.Kiosk, transform),
                "anthem1992.mp3", 0.8f, 0f, 1f, 10f, false, false);

            beepClip = CreateBeepClip();
            RegisterGeneratedSource(IntercomBeep, Host("Гудок домофона", WorldAnchors.Intercom, kiosk.parent ?? transform),
                beepClip, SfxVolume * 0.5f, 1f, 0.8f, 16f);
            RegisterSource(MagnetClick, Host("Щелчок магнитного замка", WorldAnchors.EntranceDoorHandle, kiosk.parent ?? transform),
                "stuk.mp3", SfxVolume * 0.6f, 1f, 0.7f, 18f, false, false);

            lastWeather = world.Weather;
            ApplyWeather(world.Weather);
        }

        private Transform Host(string name, Vector3 position, Transform parent)
        {
            GameObject go = new GameObject("Звук: " + name);
            go.transform.SetParent(parent != null ? parent : transform, false);
            go.transform.position = position;
            return go.transform;
        }

        /// <summary>Регистрирует 3D-источник и начинает загрузку MP3 из StreamingAssets.</summary>
        public AudioSource RegisterSource(string id, Transform host, string fileName, float volume,
            float spatialBlend, float minDistance, float maxDistance, bool loop, bool playOnLoad)
        {
            if (host == null || string.IsNullOrEmpty(id)) return null;
            AudioSource source = host.GetComponent<AudioSource>();
            if (source == null) source = host.gameObject.AddComponent<AudioSource>();

            source.playOnAwake = false;
            source.loop = loop;
            source.volume = Mathf.Clamp01(volume);
            source.spatialBlend = Mathf.Clamp01(spatialBlend);
            source.minDistance = Mathf.Max(0.01f, minDistance);
            source.maxDistance = Mathf.Max(source.minDistance + 0.1f, maxDistance);
            source.rolloffMode = AudioRolloffMode.Logarithmic;
            source.dopplerLevel = 0.35f;
            source.priority = 96;

            sources[id] = source;
            AudioLowPassFilter filter = host.GetComponent<AudioLowPassFilter>();
            if (filter == null) filter = host.gameObject.AddComponent<AudioLowPassFilter>();
            filter.cutoffFrequency = FarCutoff;
            filters[id] = filter;

            if (!string.IsNullOrEmpty(fileName))
            {
                AudioClip cached;
                if (ClipCache.TryGetValue(fileName, out cached) && cached != null)
                {
                    source.clip = cached;
                    if (playOnLoad) source.Play();
                }
                else
                {
                    StartCoroutine(LoadAndPlay(fileName, source, playOnLoad));
                }
            }
            return source;
        }

        private AudioSource RegisterGeneratedSource(string id, Transform host, AudioClip clip, float volume,
            float spatialBlend, float minDistance, float maxDistance)
        {
            AudioSource source = RegisterSource(id, host, null, volume, spatialBlend, minDistance, maxDistance, false, false);
            if (source != null && clip != null) source.clip = clip;
            return source;
        }

        private IEnumerator LoadAndPlay(string fileName, AudioSource source, bool playOnLoad)
        {
            AudioClip cached;
            while (Loading.Contains(fileName))
            {
                if (ClipCache.TryGetValue(fileName, out cached) && cached != null) break;
                yield return null;
            }
            if (source == null) yield break;
            if (ClipCache.TryGetValue(fileName, out cached) && cached != null)
            {
                source.clip = cached;
                if (playOnLoad && source.gameObject.activeInHierarchy) source.Play();
                yield break;
            }

            Loading.Add(fileName);
            string url = GameAssetPaths.ToUrl(GameAssetPaths.Audio(fileName));
            using (UnityWebRequest request = UnityWebRequestMultimedia.GetAudioClip(url, AudioType.MPEG))
            {
                DownloadHandlerAudioClip handler = request.downloadHandler as DownloadHandlerAudioClip;
                if (handler != null) handler.streamAudio = true;
                yield return request.SendWebRequest();

                if (request.result == UnityWebRequest.Result.Success)
                {
                    AudioClip clip = DownloadHandlerAudioClip.GetContent(request);
                    if (clip != null)
                    {
                        clip.name = fileName;
                        ClipCache[fileName] = clip;
                        if (source != null)
                        {
                            source.clip = clip;
                            if (playOnLoad && source.gameObject.activeInHierarchy) source.Play();
                        }
                    }
                    else Warn(fileName, "MP3 не содержит аудиоданных");
                }
                else
                {
                    Warn(fileName, request.error);
                }
            }
            Loading.Remove(fileName);
        }

        private static void Warn(string fileName, string reason)
        {
            if (!Warned.Add(fileName)) return;
            Debug.LogWarning("[Larek.World] Аудио " + fileName + ": " + reason);
        }

        // ------------------------------------------------------------------
        //  Публичный API для игровых систем
        // ------------------------------------------------------------------

        public AudioSource GetSource(string id)
        {
            AudioSource source;
            return !string.IsNullOrEmpty(id) && sources.TryGetValue(id, out source) ? source : null;
        }

        public void Play(string id)
        {
            AudioSource source = GetSource(id);
            if (source != null && source.clip != null && source.gameObject.activeInHierarchy) source.Play();
        }

        public void Stop(string id)
        {
            AudioSource source = GetSource(id);
            if (source != null) source.Stop();
        }

        public void SetEnabled(string id, bool enabled)
        {
            AudioSource source = GetSource(id);
            if (source == null) return;
            source.enabled = enabled;
            if (!enabled) source.Stop();
        }

        /// <summary>Однократный звук в заданной точке мира.</summary>
        public void PlayAt(string id, Vector3 position, float volumeScale = 1f)
        {
            AudioSource source = GetSource(id);
            if (source == null || source.clip == null) return;
            source.transform.position = position;
            float previous = source.volume;
            source.volume = Mathf.Clamp01(previous * Mathf.Max(0f, volumeScale));
            source.Play();
            if (source.loop) return;
            StartCoroutine(RestoreVolume(source, previous, source.clip.length));
        }

        private static IEnumerator RestoreVolume(AudioSource source, float volume, float delay)
        {
            if (source == null || delay <= 0f) yield break;
            yield return new WaitForSeconds(delay);
            if (source != null) source.volume = volume;
        }

        public void SetRadioOn(bool on)
        {
            radioOn = on;
            SetEnabled(RadioKiosk, on);
            SetEnabled(RadioApartment, on);
            if (on)
            {
                Play(RadioKiosk);
                if (builder != null && builder.Interactions != null && builder.Interactions.PlayerIsInsideApartment)
                    Play(RadioApartment);
            }
        }

        public void SetTvOn(bool on, int channel = 1)
        {
            tvOn = on;
            tvChannel = Mathf.Clamp(channel, 1, 10);
            string file = "tv_ch" + tvChannel + ".mp3";
            foreach (string id in new[] { TvKiosk, TvApartment })
            {
                AudioSource source = GetSource(id);
                if (source == null) continue;
                source.enabled = on;
                if (!on) { source.Stop(); continue; }
                AudioClip clip;
                if (ClipCache.TryGetValue(file, out clip) && clip != null)
                {
                    source.clip = clip;
                    source.Play();
                }
                else
                {
                    StartCoroutine(LoadAndPlay(file, source, true));
                }
            }
        }

        public void SetCityOn(bool on)
        {
            cityOn = on;
            SetEnabled(City, on);
            if (on) Play(City);
        }

        public void SetBusEngineOn(bool on) => SetEngine(BusEngine, on);
        public void SetCarEngineOn(bool on) => SetEngine(CarEngine, on);

        private void SetEngine(string id, bool on)
        {
            AudioSource source = GetSource(id);
            if (source == null) return;
            source.enabled = on;
            if (on && !source.isPlaying) source.Play();
            else if (!on) source.Stop();
        }

        /// <summary>M25: сигнал домофона 425 Гц (советская телефонная сеть).</summary>
        public void PlayIntercomBeep() => Play(IntercomBeep);

        /// <summary>M26: щелчок магнитного замка.</summary>
        public void PlayMagnetClick() => PlayAt(MagnetClick, WorldAnchors.EntranceDoorHandle);

        public void PlayFootstep(Vector3 position)
        {
            bool snow = builder != null && builder.Weather == WorldWeather.WinterSnow;
            PlayAt(snow ? FootstepSnow : Footstep, position);
        }

        public void PlayHorn(Vector3 position) => PlayAt(Horn, position);

        public void SetWeather(WorldWeather weather)
        {
            lastWeather = weather;
            ApplyWeather(weather);
        }

        private void ApplyWeather(WorldWeather weather)
        {
            bool snow = weather == WorldWeather.WinterSnow;
            AudioSource step = GetSource(Footstep);
            AudioSource snowStep = GetSource(FootstepSnow);
            if (step != null) step.enabled = !snow;
            if (snowStep != null) snowStep.enabled = snow;

            AudioSource city = GetSource(City);
            if (city != null)
                city.volume = CityVolume * (weather == WorldWeather.Clear ? 1f :
                    snow ? 0.72f : 0.86f);

            AudioLowPassFilter cityFilter;
            if (filters.TryGetValue(City, out cityFilter) && cityFilter != null)
                cityFilter.cutoffFrequency = snow ? 3200f : weather == WorldWeather.Clear ? FarCutoff : 6500f;
        }

        // ------------------------------------------------------------------
        //  Кадр: глушение стенами
        // ------------------------------------------------------------------

        private void Update()
        {
            if (builder == null) return;
            if (!lastWeather.HasValue || lastWeather.Value != builder.Weather)
            {
                lastWeather = builder.Weather;
                ApplyWeather(builder.Weather);
            }
            if (!ApplyWallMuffling) return;

            if (listener == null) listener = FindObjectOfType<AudioListener>();
            if (listener == null) return;
            Vector3 listenerPosition = listener.transform.position;
            bool inside = builder.Interactions != null && builder.Interactions.PlayerIsInsideApartment;

            foreach (KeyValuePair<string, AudioSource> pair in sources)
            {
                AudioSource source = pair.Value;
                AudioLowPassFilter filter;
                if (source == null || !filters.TryGetValue(pair.Key, out filter) || filter == null) continue;
                if (source.spatialBlend <= 0.01f) continue;

                float distance = Vector3.Distance(listenerPosition, source.transform.position);
                float cutoff = FarCutoff;
                if (inside && distance > 8f) cutoff = MuffledCutoff;
                else if (!inside && distance > 22f) cutoff = 2600f;
                filter.cutoffFrequency = Mathf.MoveTowards(filter.cutoffFrequency, cutoff, Time.deltaTime * 18000f);
            }
        }

        private static AudioClip CreateBeepClip()
        {
            const int sampleRate = 22050;
            const float length = 0.22f;
            int count = Mathf.RoundToInt(sampleRate * length);
            float[] data = new float[count];
            for (int i = 0; i < count; i++)
            {
                float t = i / (float)sampleRate;
                float envelope = Mathf.Clamp01((length - t) * 16f);
                data[i] = Mathf.Sin(2f * Mathf.PI * 425f * t) * envelope * 0.28f;
            }
            AudioClip clip = AudioClip.Create("Гудок домофона 425 Гц", count, 1, sampleRate, false);
            clip.SetData(data, 0);
            return clip;
        }

        private void OnDestroy()
        {
            StopAllCoroutines();
            foreach (AudioSource source in sources.Values)
                if (source != null) source.Stop();
        }
    }
}
