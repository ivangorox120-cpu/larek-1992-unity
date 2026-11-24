using System;
using System.IO;

namespace Larek.Save
{
    public static class SaveRepository
    {
        public static void Write(string path, LarekSave save)
        {
            if (string.IsNullOrEmpty(path)) throw new ArgumentException("Path is required.", nameof(path));
            if (save == null) throw new ArgumentNullException(nameof(save));
            string directory = Path.GetDirectoryName(path);
            if (!string.IsNullOrEmpty(directory)) Directory.CreateDirectory(directory);
            File.WriteAllText(path, save.ToText());
        }

        public static bool TryRead(string path, out LarekSave save)
        {
            save = null;
            if (string.IsNullOrEmpty(path) || !File.Exists(path)) return false;
            try
            {
                return LarekSave.TryParse(File.ReadAllText(path), out save);
            }
            catch (IOException) { return false; }
            catch (UnauthorizedAccessException) { return false; }
        }
    }
}
