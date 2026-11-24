using System.IO;
using Larek.Save;
using UnityEngine;

namespace Larek.Gameplay
{
    /// <summary>
    /// Создаёт игровую сессию до загрузки сцены и связывает её с сохранениями.
    /// Все остальные системы читают GameSession.Current.
    /// </summary>
    public sealed class GameBootstrap : MonoBehaviour
    {
        public const string SaveFileName = "larek1992.sav";
        public const string ExtrasFileName = "larek1992.extras";

        public static string SavePath { get { return Path.Combine(Application.persistentDataPath, SaveFileName); } }
        public static string ExtrasPath { get { return Path.Combine(Application.persistentDataPath, ExtrasFileName); } }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        private static void Initialize()
        {
            if (GameSession.Current != null) return;
            var session = GameSession.NewGame();
            LoadFull(session);
        }

        public static void SaveFull(GameSession session = null)
        {
            GameSession current = session ?? GameSession.Current;
            if (current == null) return;
            GameSessionSnapshot snapshot = current.CaptureFull();
            SaveRepository.Write(SavePath, snapshot.Save);
            File.WriteAllText(ExtrasPath, snapshot.Extras ?? string.Empty);
        }

        public static bool LoadFull(GameSession session = null)
        {
            GameSession current = session ?? GameSession.Current;
            if (current == null) return false;
            LarekSave save;
            if (!SaveRepository.TryRead(SavePath, out save)) return false;
            string extras = File.Exists(ExtrasPath) ? File.ReadAllText(ExtrasPath) : string.Empty;
            current.Restore(save, extras);
            return true;
        }

        public static void NewGame()
        {
            GameSession.NewGame();
            if (File.Exists(SavePath)) File.Delete(SavePath);
            if (File.Exists(ExtrasPath)) File.Delete(ExtrasPath);
        }

        private void OnApplicationPause(bool paused)
        {
            if (paused) SaveFull();
        }

        private void OnApplicationQuit()
        {
            SaveFull();
        }
    }
}
