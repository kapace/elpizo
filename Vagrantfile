VAGRANTFILE_API_VERSION = "2"

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|
  config.vm.box = "parallels/ubuntu-14.04"
  config.vm.network :forwarded_port, host: 8081, guest: 80

  config.vm.provision :shell, path: "bootstrap.sh"
  config.vm.provision :shell, inline: "service nginx start", run: :always

  config.vm.provider "parallels" do |v|
    v.memory = 2048
    v.cpus = 4
  end
end
